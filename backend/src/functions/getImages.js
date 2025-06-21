const { app } = require('@azure/functions');
const { TableClient } = require("@azure/data-tables");
// MODIFIED: Import all necessary components
const { BlobServiceClient, StorageSharedKeyCredential, BlobSASPermissions } = require("@azure/storage-blob");

// MODIFIED: Use the explicit, consistent way to create clients
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = "images";
const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
const blobServiceClient = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  sharedKeyCredential
);
const tableClient = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "imageanalysis");

app.http('getImages', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            context.log(`[getImages] HTTP trigger processed a request.`);
            const entitiesIterator = tableClient.listEntities();
            const results = [];
            const containerClient = blobServiceClient.getContainerClient(containerName);

            for await (const entity of entitiesIterator) {
                const blobClient = containerClient.getBlobClient(entity.rowKey);

                const displayUrl = await blobClient.generateSasUrl({
                    permissions: BlobSASPermissions.parse("r"),
                    expiresOn: new Date(new Date().valueOf() + 3600 * 1000),
                });

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
// const { BlobServiceClient, BlobSASPermissions } = require("@azure/storage-blob"); // Simplified import

// // This client gets its credentials from AzureWebJobsStorage, which is correct
// const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AzureWebJobsStorage);
// const containerName = "images";
// const tableClient = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "imageanalysis");

// app.http('getImages', {
//     methods: ['GET'],
//     authLevel: 'anonymous',
//     handler: async (request, context) => {
//         try {
//             context.log(`[getImages] HTTP trigger processed a request.`);
//             const entitiesIterator = tableClient.listEntities();
//             const results = [];
//             const containerClient = blobServiceClient.getContainerClient(containerName);

//             for await (const entity of entitiesIterator) {
//                 const blobClient = containerClient.getBlobClient(entity.rowKey);

//                 const displayUrl = await blobClient.generateSasUrl({
//                     permissions: BlobSASPermissions.parse("r"),
//                     expiresOn: new Date(new Date().valueOf() + 3600 * 1000),
//                 });

//                 results.push({ ...entity, displayUrl });
//             }

//             return {
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify(results)
//             };

//         } catch (error) {
//             context.error(`[getImages] Error: ${error.message}`);
//             return {
//                 status: 500,
//                 body: JSON.stringify({ message: "An error occurred while fetching the image list." })
//             };
//         }
//     }
// });