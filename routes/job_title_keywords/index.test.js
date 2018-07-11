const { assert } = require("chai");
const request = require("supertest");
const { connectMongo } = require("../../models/connect");

const app = require("../../app");
const create_capped_collection = require("../../database/migrations/create-jobTitleKeywords-collection");

describe("job_title_keywords", () => {
    let db;

    before(async () => {
        ({ db } = await connectMongo());
    });

    describe("company", () => {
        before(() =>
            db
                .collection("job_title_keywords")
                .insertMany([
                    { word: "GoodJob" },
                    { word: "GoodJob" },
                    { word: "GoodJob" },
                    { word: "GoodJob2" },
                    { word: "GoodJob2" },
                    { word: "GoodJob3" },
                    { word: "GoodJob4" },
                    { word: "GoodJob5" },
                    { word: "GoodJob6" },
                ])
        );

        it("will return keywords in order", () =>
            request(app)
                .get("/job_title_keywords")
                .query({ num: "2" })
                .expect(200)
                .expect(res => {
                    assert.isArray(res.body.keywords);
                    assert.equal(res.body.keywords.length, 2);
                    assert.equal(res.body.keywords[0], "GoodJob");
                    assert.equal(res.body.keywords[1], "GoodJob2");
                }));

        it("number should be 1~20", () =>
            request(app)
                .get("/job_title_keywords")
                .query({ num: "0" })
                .expect(422));

        it("number should be 1~20", () =>
            request(app)
                .get("/job_title_keywords")
                .query({ num: "100" })
                .expect(422));

        it("num should be integer number", () =>
            request(app)
                .get("/job_title_keywords")
                .query({ num: "10.5" })
                .expect(422));

        it("number default will be 5", () =>
            request(app)
                .get("/job_title_keywords")
                .expect(200)
                .expect(res => {
                    assert.isArray(res.body.keywords);
                    assert.lengthOf(res.body.keywords, 5);
                }));

        after(() =>
            db
                .collection("job_title_keywords")
                .drop()
                .then(() => create_capped_collection(db))
        );
    });
});
