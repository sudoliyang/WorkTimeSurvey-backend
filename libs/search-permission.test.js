const chai = require("chai");
chai.use(require("chai-as-promised"));

const assert = chai.assert;
const { connectMongo } = require("../models/connect");
const ObjectId = require("mongodb").ObjectId;
const permission = require("./search-permission");

describe("Permission Library", () => {
    let db;

    before(async () => {
        ({ db } = await connectMongo());
    });

    const test_data = [{ expected: false }];
    [1, 0, undefined].forEach(time_and_salary_count => {
        [1, 0, undefined].forEach(reference_count => {
            test_data.push({
                counts: {
                    time_and_salary_count,
                    reference_count,
                },
                expected:
                    (time_and_salary_count || 0) + (reference_count || 0) > 0,
            });
        });
    });

    test_data.forEach(data => {
        describe(`correctly authorize user with ${JSON.stringify(
            data
        )}`, () => {
            before(async () => {
                // insert test data into db
                if (data.counts) {
                    await db.collection("users").insert({
                        facebook_id: "peter.shih",
                        time_and_salary_count:
                            data.counts.time_and_salary_count,
                    });

                    await db.collection("recommendations").insert({
                        user: {
                            id: "peter.shih",
                            type: "facebook",
                        },
                        count: data.counts.reference_count,
                    });
                }
            });

            it("search permission for user", () => {
                const user = {
                    id: "peter.shih",
                    type: "facebook",
                };

                return assert.becomes(
                    permission.resolveSearchPermission(db, user),
                    data.expected
                );
            });

            after(async () => {
                await db.collection("users").deleteMany({});
                await db.collection("recommendations").deleteMany({});
            });
        });
    });

    describe("shared experiences", () => {
        before(async () => {
            const user_id = ObjectId();
            await db.collection("users").insertOne({
                _id: user_id,
                facebook_id: "power.id",
            });
            await db
                .collection("experiences")
                .insertOne({ author_id: user_id });
        });

        it("search permission for user", async () => {
            const user = {
                id: "power.id",
                type: "facebook",
            };

            assert.isTrue(await permission.resolveSearchPermission(db, user));
        });

        after(async () => {
            await db.collection("experiences").deleteMany({});
            await db.collection("users").deleteMany({});
        });
    });
});
