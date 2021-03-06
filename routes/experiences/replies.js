const express = require("express");
const passport = require("passport");
const R = require("ramda");

const { ensureToObjectId } = require("../../models");
const ExperienceModel = require("../../models/experience_model");
const ReplyModel = require("../../models/reply_model");
const ReplyLikeModel = require("../../models/reply_like_model");
const PopularExperienceLogsModel = require("../../models/popular_experience_logs_model");
const { semiAuthentication } = require("../../middlewares/authentication");
const { HttpError } = require("../../libs/errors");
const {
    requiredNumberInRange,
    requiredNonEmptyString,
    stringRequireLength,
} = require("../../libs/validation");
const wrap = require("../../libs/wrap");
const { combineSelector } = require("../../view_models/helper");

const router = express.Router();

const MAX_CONTENT_SIZE = 1000;

function validationPostFields(body) {
    if (!requiredNonEmptyString(body.content)) {
        throw new HttpError("留言內容必填！", 422);
    }
    if (!stringRequireLength(body.content, 1, MAX_CONTENT_SIZE)) {
        throw new HttpError("留言內容請少於 1000 個字元", 422);
    }
}

/**
 * @api {post} /experiences/:id/replies 新增單篇經驗的留言 API
 * @apiGroup Experiences Replies
 * @apiParam {String="0 < length <= 1000 "} content 留言內容
 * @apiSuccess {Object} reply 該留言的物件
 * @apiSuccess {String} reply._id 留言的ID
 * @apiSuccess {String} reply.content 留言的內容
 * @apiSuccess {Number} reply.like_count 留言的讚數
 * @apiSuccess {Number} reply.like_count 留言的檢舉數
 * @apiSuccess {Number} reply.floor 該留言的樓層數 (整數, index from 0)
 * @apiSuccess {String} reply.created_at 該留言的時間
 */
router.post("/:id/replies", [
    passport.authenticate("bearer", { session: false }),
    wrap(async (req, res) => {
        validationPostFields(req.body);

        const user = req.user;
        const experience_id_string = req.params.id;
        // pick fields from post body
        const content = req.body.content;

        const experience_model = new ExperienceModel(req.db);
        const reply_model = new ReplyModel(req.db);
        const popular_experience_logs_model = new PopularExperienceLogsModel(
            req.db
        );

        const partial_reply = {
            author_id: user._id,
            content,
        };

        const experience_id = ensureToObjectId(experience_id_string);

        await experience_model.findOneOrFail(experience_id, { _id: 1 });

        const reply = await reply_model.createReply(
            experience_id,
            partial_reply
        );
        await popular_experience_logs_model.insertLog({
            experience_id,
            user_id: user._id,
            action_type: "reply",
        });

        // 事實上 reply === partial_reply
        res.send({ reply });
    }),
]);

const replyView = R.pick([
    "_id",
    "content",
    "like_count",
    "report_count",
    "created_at",
    "floor",
]);

const repliesView = R.map(replyView);

/**
 * @api {get} /experiences/:id/replies 取得單篇經驗的留言列表 API
 * @apiGroup Experiences Replies
 * @apiParam {String="整數"} [start=0] (從第 start 個留言開始 (start =0為第1筆留言）)
 * @apiParam {String="整數, 0 < N <= 1000"} [limit =20] 回傳最多limit個留言
 * @apiSuccess {Object[]} replies 該留言的物件陣列 (由第1樓排到第N樓。第1樓為該篇經驗分享的時間最早的第一個留言，依此類推
 * @apiSuccess {String} replies._id 留言的ID
 * @apiSuccess {String} replies.content 留言的內容
 * @apiSuccess {Number} replies.like_count 留言的讚數
 * @apiSuccess {Number} replies.report_count 留言的檢舉數
 * @apiSuccess {Boolean} [replies.liked] 該留言是否已經被該名使用按讚過(使用者登入時才會回傳此欄位)
 * @apiSuccess {String} replies.created_at 該留言的時間
 * @apiSuccess {Number} replies.floor 樓層
 */
router.get("/:id/replies", [
    semiAuthentication("bearer", { session: false }),
    wrap(async (req, res) => {
        const experience_id_string = req.params.id;
        const limit = parseInt(req.query.limit, 10) || 20;
        const start = parseInt(req.query.start, 10) || 0;

        if (!requiredNumberInRange(limit, 1, 1000)) {
            throw new HttpError("limit 格式錯誤", 422);
        }

        const experience_model = new ExperienceModel(req.db);
        const reply_model = new ReplyModel(req.db);
        const reply_like_model = new ReplyLikeModel(req.db);

        const experience_id = ensureToObjectId(experience_id_string);
        await experience_model.findOneOrFail(experience_id, { _id: 1 });

        const replies = await reply_model.getPublishedRepliesByExperienceId(
            experience_id,
            start,
            limit
        );

        if (req.user) {
            const user = req.user;

            const replies_ids = replies.map(reply => reply._id);
            const likes = await reply_like_model.getReplyLikesByRepliesIdsAndUser(
                replies_ids,
                user
            );

            const likedSelector = reply => ({
                liked: R.any(like => like.reply_id.equals(reply._id))(likes),
            });
            const repliesView = R.map(
                combineSelector([replyView, likedSelector])
            );

            res.send({
                replies: repliesView(replies),
            });

            return;
        }

        res.send({
            replies: repliesView(replies),
        });
    }),
]);

module.exports = router;
