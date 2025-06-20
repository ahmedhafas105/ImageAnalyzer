const { app } = require('@azure/functions');
const { TableClient } = require("@azure/data-tables");

// NEW: Import the necessary clients and credentials for generating a SAS token
const { BlobServiceClient, StorageSharedKeyCredential, BlobSASPermissions } = require("@azure/storage-blob");

// NEW: Create a BlobServiceClient to interact with storage
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
const blobServiceClient = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, sharedKeyCredential);
const containerName = "images";

// Create a client to connect to Azure Table Storage
const tableClient = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "imageanalysis");

app.http('getImages', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`[getImages] HTTP trigger processed a request.`);
        try {
            const entitiesIterator = tableClient.listEntities();
            const results = [];
            const containerClient = blobServiceClient.getContainerClient(containerName);

            for await (const entity of entitiesIterator) {
                // For each image record from the table...
                const blobClient = containerClient.getBlobClient(entity.rowKey);

                // ...generate a temporary, read-only SAS URL for display purposes.
                const displayUrl = await blobClient.generateSasUrl({
                    permissions: BlobSASPermissions.parse("r"), // "r" for read-only
                    expiresOn: new Date(new Date().valueOf() + 3600 * 1000), // 1 hour validity
                });

                // Add the temporary displayUrl to the object we send to the frontend
                results.push({ ...entity, displayUrl });
            }

            return {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(results)
            };

        } catch (error) {
            context.error(`[getImages] Error: ${error.message}`);
            return {
                status: 500,
                body: JSON.stringify({ message: "An error occurred while fetching the image list." })
            };
        }
    }
});

// const { app } = require('@azure/functions');
// const { TableClient } = require("@azure/data-tables");

// const tableClient = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "imageanalysis");

// app.http('getImages', {
//     methods: ['GET'],
//     authLevel: 'anonymous',
//     handler: async (request, context) => {
//         context.log(`[getImages] HTTP trigger processed a request.`);
//         try {
//             const entitiesIterator = tableClient.listEntities();
//             const results = [];
//             for await (const entity of entitiesIterator) {
//                 results.push(entity);
//             }

//             return { 
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify(results) 
//             };

//         } catch (error) {
//             // THE FIX IS HERE: Changed from context.log.error to context.error
//             context.error(`[getImages] Error: ${error.message}`);
//             return {
//                 status: 500,
//                 body: JSON.stringify({ message: "An error occurred while fetching the image list." })
//             };
//         }
//     }
// });