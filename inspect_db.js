const { MongoClient } = require('mongodb');

async function main() {
    const uri = "mongodb+srv://bet365odds:Aurora86@cluster0.svytet0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log("Connected to MongoDB");
        
        const db = client.db(); // uses default db from URI or 'test'
        const collections = await db.listCollections().toArray();
        console.log("Collections:", collections.map(c => c.name));

        for (const collection of collections) {
            const count = await db.collection(collection.name).countDocuments();
            console.log(`- ${collection.name}: ${count} documents`);
            const sample = await db.collection(collection.name).findOne();
            console.log(`  Sample:`, JSON.stringify(sample, null, 2));
        }
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

main();
