const { app } = require('@azure/functions');
const { TableClient } = require("@azure/data-tables");
const axios = require("axios");

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

app.storageBlob('processImage', {
    path: 'images/{name}',
    connection: 'AzureWebJobsStorage',
    handler: async (blob, context) => {
        const blobName = context.triggerMetadata.name;
        context.log(`[processImage] Blob trigger function processing blob: ${blobName}`);

        try {
            // --- The Fix Starts Here ---
            
            // NEW: Create a client for the specific blob that triggered the function
            const blobClient = blobServiceClient.getContainerClient(containerName).getBlobClient(blobName);

            // NEW: Generate a SAS URL that grants read-only access for 1 hour
            const imageUrlWithSas = await blobClient.generateSasUrl({
                permissions: BlobSASPermissions.parse("r"), // "r" for read-only access
                expiresOn: new Date(new Date().valueOf() + 3600 * 1000), // 1 hour from now
            });
            
            // --- The Fix Ends Here ---

            const sightengineApiUser = process.env.SIGHTENGINE_API_USER;
            const sightengineApiSecret = process.env.SIGHTENGINE_API_SECRET;
            
            // MODIFIED: Use the new SAS URL to call Sightengine
            const response = await axios.get('https://api.sightengine.com/1.0/check.json', {
                params: { 
                    'url': imageUrlWithSas, // Use the temporary, accessible URL
                    'models': 'nudity-2.0', 
                    'api_user': sightengineApiUser, 
                    'api_secret': sightengineApiSecret 
                }
            });

            const nudity = response.data.nudity;
            const isAdult = nudity.sexual_activity > 0.5 || nudity.explicit > 0.5 || nudity.suggestive > 0.8;

            const entity = {
                partitionKey: "images",
                rowKey: blobName,
                imageUrl: context.triggerMetadata.uri, // Store the original, private URL
                isAdult: isAdult,
                sightengineResponse: JSON.stringify(response.data)
            };

            await tableClient.upsertEntity(entity, "Merge");
            context.log(`[processImage] SUCCESS: Analysis for ${blobName} complete. Is Adult: ${isAdult}`);

        } catch (error) {
            // This will now catch any real errors from Sightengine
            context.error(`[processImage] Error processing ${blobName}: ${error.message}`);
        }
    }
});

// const { app } = require('@azure/functions');
// const { TableClient } = require("@azure/data-tables");
// const axios = require("axios");

// const tableClient = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "imageanalysis");

// app.storageBlob('processImage', {
//     path: 'images/{name}',
//     connection: 'AzureWebJobsStorage',
//     handler: async (blob, context) => {
//         const blobName = context.triggerMetadata.name;
//         const imageUrl = context.triggerMetadata.uri;
//         context.log(`[processImage] Blob trigger function processing blob: ${blobName}`);

//         try {
//             const sightengineApiUser = process.env.SIGHTENGINE_API_USER;
//             const sightengineApiSecret = process.env.SIGHTENGINE_API_SECRET;

//             const response = await axios.get('https://api.sightengine.com/1.0/check.json', {
//                 params: { 'url': imageUrl, 'models': 'nudity-2.0', 'api_user': sightengineApiUser, 'api_secret': sightengineApiSecret }
//             });

//             const nudity = response.data.nudity;
//             const isAdult = nudity.sexual_activity > 0.5 || nudity.explicit > 0.5 || nudity.suggestive > 0.8;

//             const entity = {
//                 partitionKey: "images",
//                 rowKey: blobName,
//                 imageUrl: imageUrl,
//                 isAdult: isAdult,
//                 sightengineResponse: JSON.stringify(response.data)
//             };

//             await tableClient.upsertEntity(entity, "Merge");
//             context.log(`[processImage] Analysis for ${blobName} complete. Is Adult: ${isAdult}`);

//         } catch (error) {
//             // THE FIX IS HERE: Changed from context.log.error to context.error
//             context.error(`[processImage] Error processing ${blobName}: ${error.message}`);
//         }
//     }
// });

// const { app } = require('@azure/functions');
// const { TableClient } = require("@azure/data-tables");
// const axios = require("axios");

// // Create a client to connect to Azure Table Storage
// const tableClient = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "imageanalysis");

// // THIS IS THE CORRECT FUNCTION DEFINITION FOR processImage
// app.storageBlob('processImage', {
//     path: 'images/{name}',
//     connection: 'AzureWebJobsStorage',
//     handler: async (blob, context) => {
//         const blobName = context.triggerMetadata.name;
//         const imageUrl = context.triggerMetadata.uri;
//         context.log(`[processImage] Blob trigger function processing blob: ${blobName}`);

//         try {
//             const sightengineApiUser = process.env.SIGHTENGINE_API_USER;
//             const sightengineApiSecret = process.env.SIGHTENGINE_API_SECRET;

//             const response = await axios.get('https://api.sightengine.com/1.0/check.json', {
//                 params: { 'url': imageUrl, 'models': 'nudity-2.0', 'api_user': sightengineApiUser, 'api_secret': sightengineApiSecret }
//             });

//             const nudity = response.data.nudity;
//             const isAdult = nudity.sexual_activity > 0.5 || nudity.explicit > 0.5 || nudity.suggestive > 0.8;

//             const entity = {
//                 partitionKey: "images",
//                 rowKey: blobName,
//                 imageUrl: imageUrl,
//                 isAdult: isAdult,
//                 sightengineResponse: JSON.stringify(response.data)
//             };

//             await tableClient.upsertEntity(entity, "Merge");
//             context.log(`[processImage] Analysis for ${blobName} complete. Is Adult: ${isAdult}`);

//         } catch (error) {
//             context.log.error(`[processImage] Error processing ${blobName}: ${error.message}`);
//         }
//     }
// });
