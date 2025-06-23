const { app } = require('@azure/functions');
const { TableClient } = require("@azure/data-tables");
// MODIFIED: Import all necessary components
const { BlobServiceClient, StorageSharedKeyCredential } = require("@azure/storage-blob");

const { verifyFirebaseToken } = require('../../auth-middleware'); // Import middleware

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

app.http('deleteImage', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    handler: async (request, context) => {

        const authResult = await verifyFirebaseToken(request, context);
        if (authResult.error) return authResult.error;

        const userId = authResult.user.uid;

        try {
            const data = await request.json();
            const blobName = data.blobName;

            if (!blobName) {
                return { status: 400, body: "Please provide a blobName." };
            }

            context.log(`[deleteImage] Deleting blob: ${blobName}`);

            const blobClient = blobServiceClient.getContainerClient(containerName).getBlobClient(blobName);
            await blobClient.delete();
            context.log(`[deleteImage] Deleted blob: ${blobName}`);

            await tableClient.deleteEntity(userId, blobName);
            context.log(`[deleteImage] Deleted table entity for: ${blobName}`);

            return { status: 200, body: `Successfully deleted ${blobName}` };

        } catch (error) {
            context.error(`[deleteImage] Error: ${error.message}`);
            return { status: 500, body: "An error occurred during deletion." };
        }
    }
});

// const { app } = require('@azure/functions');
// const { TableClient } = require("@azure/data-tables");
// const { BlobServiceClient } = require("@azure/storage-blob"); // Simplified import

// // This client gets its credentials from AzureWebJobsStorage, which is correct
// const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AzureWebJobsStorage);
// const containerName = "images";
// const tableClient = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "imageanalysis");

// app.http('deleteImage', {
//     methods: ['DELETE'],
//     authLevel: 'anonymous',
//     handler: async (request, context) => {
//         try {
//             const data = await request.json();
//             const blobName = data.blobName;

//             if (!blobName) {
//                 return { status: 400, body: "Please provide a blobName." };
//             }

//             context.log(`[deleteImage] Deleting blob: ${blobName}`);

//             // 1. Delete the blob
//             const blobClient = blobServiceClient.getContainerClient(containerName).getBlobClient(blobName);
//             await blobClient.delete();
//             context.log(`[deleteImage] Deleted blob: ${blobName}`);

//             // 2. Delete the table record
//             await tableClient.deleteEntity("images", blobName);
//             context.log(`[deleteImage] Deleted table entity for: ${blobName}`);

//             return { status: 200, body: `Successfully deleted ${blobName}` };

//         } catch (error) {
//             context.error(`[deleteImage] Error: ${error.message}`);
//             return { status: 500, body: "An error occurred during deletion." };
//         }
//     }
// });