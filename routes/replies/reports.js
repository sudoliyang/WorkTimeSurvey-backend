const express = require("express");
const passport = require("passport");
const HttpError = require("../../libs/errors").HttpError;

const router = express.Router();
const ReportModel = require("../../models/report_model");
const wrap = require("../../libs/wrap");
const ObjectNotExistError = require("../../libs/errors").ObjectNotExistError;
const DuplicateKeyError = require("../../libs/errors").DuplicateKeyError;
const {
    requiredNumberInRange,
    requiredNonEmptyString,
    stringRequireLength,
    shouldIn,
} = require("../../libs/validation");

function validatePostFields(body) {
    if (
        !shouldIn(body.reason_category, [
            "這是廣告或垃圾訊息",
            "我認為這篇文章涉及人身攻擊、誹謗",
            "我認為這篇文章內容不實",
            "其他",
        ])
    ) {
        throw new HttpError("檢舉原因分類錯誤", 422);
    }
    if (body.reason_category !== "這是廣告或垃圾訊息") {
        if (!requiredNonEmptyString(body.reason)) {
            throw new HttpError("原因必填！", 422);
        } else if (!stringRequireLength(body.reason, 1, 500)) {
            throw new HttpError("原因需在 1~500 字！", 422);
        }
    }
}

function _reportViewModel(report) {
    let result = {
        _id: report._id,
        reason_category: report.reason_category,
        created_at: report.created_at,
    };

    if (report.reason) {
        result = Object.assign(result, {
            reason: report.reason,
        });
    }
    return result;
}

function _reportsViewModel(reports) {
    return reports.map(report => _reportViewModel(report));
}

/* eslint-disable */
/**
 * @api {post} /replies/:id/reports 新增單篇留言的檢舉 API
 * @apiGroup Experiences Reports
 * @apiParam {String="這是廣告或垃圾訊息", "我認為這篇文章涉及人身攻擊、誹謗", "我認為這篇文章內容不實", "其他"} reason_category 檢舉的原因分類
 * @apiParam {String="0 < length <= 500"} reason 檢舉的原因詳述
 * @apiSuccess {Object} report 該檢舉的物件
 * @apiSuccess {String} report._id 該檢舉的ID
 * @apiSuccess {String="這是廣告或垃圾訊息", "我認為這篇文章涉及人身攻擊、誹謗", "我認為這篇文章內容不實", "其他"} report.reason_category 檢舉的原因分類
 * @apiSuccess {String} report.reason 檢舉的原因詳述。 當 reason_category = `這是廣告或垃圾訊息`，且 request 中未給 reason，則不會回傳此欄位（直接缺這個欄位，而非等於 undefined）。
 * @apiSuccess {String} report.created_at 該檢舉的時間
 */
/* eslint-enable */
router.post("/:id/reports", [
    passport.authenticate("bearer", { session: false }),
    wrap(async (req, res) => {
        validatePostFields(req.body);

        const user = req.user;
        const reply_id_str = req.params.id;

        const report_model = new ReportModel(req.db);

        let partial_report = {
            namespace: "replies",
            user_id: user._id,
            reason_category: req.body.reason_category,
        };

        if (req.body.reason) {
            partial_report = Object.assign(partial_report, {
                reason: req.body.reason,
            });
        }

        try {
            const report = await report_model.createReportToReply(
                reply_id_str,
                partial_report
            );

            const response = {
                report: _reportViewModel(report),
            };
            res.send(response);
        } catch (err) {
            if (err instanceof DuplicateKeyError) {
                throw new HttpError(err.message, 403);
            } else if (err instanceof ObjectNotExistError) {
                throw new HttpError(err.message, 404);
            }
            throw err;
        }
    }),
]);

/* eslint-disable */
/**
 * @api {get} /replies/:id/reports 取得單篇留言的檢舉列表 API
 * @apiGroup Experiences Replies
 * @apiParam {String="整數"} [start=0] (從第 start 個檢舉開始 (start =0為第1筆檢舉）)
 * @apiParam {String="整數, 0 < N <= 1000"} [limit =20] 回傳最多limit個檢舉
 * @apiSuccess {Object[]} reports 該檢舉的物件陣列
 * @apiSuccess {String} reports._id 該檢舉的ID
 * @apiSuccess {String="這是廣告或垃圾訊息", "我認為這篇文章涉及人身攻擊、誹謗", "我認為這篇文章內容不實", "其他"} reports.reason_category 檢舉的原因分類
 * @apiSuccess {String} reports.reason 檢舉的原因詳述。 若 reason_category = `這是廣告或垃圾訊息` 則不會有本欄位。但若為其他分類，則會有此欄位。
 * @apiSuccess {String} reports.created_at 該檢舉的時間
 */
/* eslint-enable */
router.get("/:id/reports", [
    wrap(async (req, res) => {
        const reply_id_str = req.params.id;
        const limit = parseInt(req.query.limit, 10) || 20;
        const start = parseInt(req.query.start, 10) || 0;

        if (!requiredNumberInRange(limit, 1, 1000)) {
            throw new HttpError("limit 格式錯誤", 422);
        }

        const report_model = new ReportModel(req.db);

        try {
            const reports = await report_model.getReportsByReplyId(
                reply_id_str,
                start,
                limit
            );

            const result = {
                reports: _reportsViewModel(reports),
            };
            res.send(result);
        } catch (err) {
            if (err instanceof ObjectNotExistError) {
                throw new HttpError(err.message, 404);
            }
            throw err;
        }
    }),
]);

module.exports = router;
