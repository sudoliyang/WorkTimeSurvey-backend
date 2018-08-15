const { assert } = require("chai");
const { connectMongo } = require("../../models/connect");
const migration = require("./migration-2018-08-15-add-archive-to-workings");

describe("Migrate workings (add adchived related field)", function() {
    let db;

    before(async () => {
        ({ db } = await connectMongo());
    });

    it("should add two fields", async () => {
        const collection = db.collection("workings");

        await collection.insertOne({ title: "Good" });

        await migration(db);

        const experience = await collection.findOne();
        assert.propertyVal(experience, "is_archive", false);
        assert.propertyVal(experience, "archive_reason", "");
    });

    after(async () => {
        await db.collection("workings").deleteMany({});
    });
});