const { app } = require('@azure/functions');
const { TableClient } = require("@azure/data-tables");
const axios = require("axios");
const { BlobServiceClient, StorageSharedKeyCredential, BlobSASPermissions } = require("@azure/storage-blob");

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = "images";

const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
const blobServiceClient = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  sharedKeyCredential
);
const tableClient = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "imageanalysis");

app.storageBlob('processImage', {
    path: 'images/{userId}/{name}',
    connection: 'AzureWebJobsStorage',
    handler: async (blob, context) => {
        const userId = context.triggerMetadata.userId;
        const blobName = context.triggerMetadata.name;
        const fullBlobName = `${userId}/${blobName}`;
        context.log(`[processImage] Processing blob: ${fullBlobName}`);

        try {
            // MODIFIED: Use the fullBlobName to get the correct blob client
            const blobClient = blobServiceClient.getContainerClient(containerName).getBlobClient(fullBlobName);
            const imageUrlWithSas = await blobClient.generateSasUrl({
                permissions: BlobSASPermissions.parse("r"),
                expiresOn: new Date(new Date().valueOf() + 3600 * 1000),
            });
            
            const sightengineApiUser = process.env.SIGHTENGINE_API_USER;
            const sightengineApiSecret = process.env.SIGHTENGINE_API_SECRET;
            
            const models_to_check = 'nudity-2.0,wad,offensive,self-harm,violence,gore';
            
            const response = await axios.get('https://api.sightengine.com/1.0/check.json', {
                params: {
                    'url': imageUrlWithSas,
                    'models': models_to_check,
                    'api_user': sightengineApiUser,
                    'api_secret': sightengineApiSecret
                }
            });

            const data = response.data;
            
            // --- THE FIX IS HERE ---
            // Using optional chaining (?.) and nullish coalescing (??) to handle cases
            // where Sightengine doesn't return a specific model object for a clean image.
            
            const isAdult = ((data.nudity?.sexual_activity ?? 0) > 0.5 || (data.nudity?.explicit ?? 0) > 0.5 || (data.nudity?.suggestive ?? 0) > 0.8);
            const isWeapon = (data.weapon ?? 0) > 0.5;
            const isDrugs = (data.drugs ?? 0) > 0.5;
            const isOffensive = (data.offensive?.prob ?? 0) > 0.5;
            const isSelfHarm = (data.self_harm?.prob ?? 0) > 0.5;
            const isViolent = (data.violence?.prob ?? 0) > 0.5;
            const isGore = (data.gore?.prob ?? 0) > 0.5;

            const entity = {
                partitionKey: userId,
                rowKey: blobName,
                imageUrl: context.triggerMetadata.uri,
                isAdult, isViolent, isOffensive, isWeapon, isDrugs, isSelfHarm, isGore,
                sightengineResponse: JSON.stringify(data)
            };

            await tableClient.upsertEntity(entity, "Merge");
            context.log(`[processImage] SUCCESS: Analysis for ${blobName} complete.`);

        } catch (error) {
            context.error(`[processImage] Error processing ${blobName}: ${error.message}`);
        }
    }
});

// const { app } = require('@azure/functions');
// const { TableClient } = require("@azure/data-tables");
// const axios = require("axios");
// const { BlobServiceClient, StorageSharedKeyCredential, BlobSASPermissions } = require("@azure/storage-blob");

// const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
// const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
// const containerName = "images";

// const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
// const blobServiceClient = new BlobServiceClient(
//   `https://${accountName}.blob.core.windows.net`,
//   sharedKeyCredential
// );
// const tableClient = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "imageanalysis");

// app.storageBlob('processImage', {
//     path: 'images/{name}',
//     connection: 'AzureWebJobsStorage',
//     handler: async (blob, context) => {
//         const blobName = context.triggerMetadata.name;
//         context.log(`[processImage] Processing blob: ${blobName}`);

//         try {
//             const blobClient = blobServiceClient.getContainerClient(containerName).getBlobClient(blobName);
//             const imageUrlWithSas = await blobClient.generateSasUrl({
//                 permissions: BlobSASPermissions.parse("r"),
//                 expiresOn: new Date(new Date().valueOf() + 3600 * 1000),
//             });
            
//             const sightengineApiUser = process.env.SIGHTENGINE_API_USER;
//             const sightengineApiSecret = process.env.SIGHTENGINE_API_SECRET;
            
//             // --- THE FIX IS HERE ---
//             // Using a more efficient and API-plan-friendly combination of models.
//             // 'wad' checks for weapons, alcohol, and drugs.
//             const models_to_check = 'nudity-2.0,wad,offensive,self-harm';
            
//             const response = await axios.get('https://api.sightengine.com/1.0/check.json', {
//                 params: {
//                     'url': imageUrlWithSas,
//                     'models': models_to_check,
//                     'api_user': sightengineApiUser,
//                     'api_secret': sightengineApiSecret
//                 }
//             });

//             const data = response.data;
            
//             // Note: The 'violence' model is often part of more expensive plans. 
//             // The 'wad' and 'offensive' models cover most common moderation needs.

//             const isAdult = (data.nudity.sexual_activity > 0.5 || data.nudity.explicit > 0.5 || data.nudity.suggestive > 0.8);
//             const isWeapon = data.weapon > 0.5; // The 'wad' model returns a simple probability for each
//             const isDrugs = data.drugs > 0.5;
//             const isOffensive = data.offensive.prob > 0.5;
//             const isSelfHarm = data.self_harm.prob > 0.5;

//             // Since 'violence' is often a separate check, we will set it to false
//             // unless you have a plan that supports it in this combination.
//             const isViolent = false; 

//             const entity = {
//                 partitionKey: "images",
//                 rowKey: blobName,
//                 imageUrl: context.triggerMetadata.uri,
//                 isAdult, isViolent, isOffensive, isWeapon, isDrugs, isSelfHarm,
//                 sightengineResponse: JSON.stringify(data)
//             };

//             await tableClient.upsertEntity(entity, "Merge");
//             context.log(`[processImage] SUCCESS: Analysis for ${blobName} complete.`);

//         } catch (error) {
//             context.error(`[processImage] Error processing ${blobName}: ${error.message}`);
//         }
//     }
// });

// const { app } = require('@azure/functions');
// const { TableClient } = require("@azure/data-tables");
// const axios = require("axios");
// const { BlobServiceClient, StorageSharedKeyCredential, BlobSASPermissions } = require("@azure/storage-blob");

// // These clients are used throughout the function
// const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
// const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
// const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
// const blobServiceClient = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, sharedKeyCredential);
// const containerName = "images";
// const tableClient = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "imageanalysis");

// app.storageBlob('processImage', {
//     path: 'images/{name}',
//     connection: 'AzureWebJobsStorage',
//     handler: async (blob, context) => {
//         const blobName = context.triggerMetadata.name;
//         context.log(`[processImage] Processing blob: ${blobName}`);

//         try {
//             // --- THIS IS THE CRUCIAL FIX ---
//             // Create a temporary, public URL with a SAS token so Sightengine can access the private blob
//             const blobClient = blobServiceClient.getContainerClient(containerName).getBlobClient(blobName);
//             const imageUrlWithSas = await blobClient.generateSasUrl({
//                 permissions: BlobSASPermissions.parse("r"), // Read-only access
//                 expiresOn: new Date(new Date().valueOf() + 3600 * 1000), // Valid for 1 hour
//             });
//             // --- END OF FIX ---

//             const sightengineApiUser = process.env.SIGHTENGINE_API_USER;
//             const sightengineApiSecret = process.env.SIGHTENGINE_API_SECRET;

//             // Check for all the models you requested
//             const models_to_check = 'nudity-2.0,violence,offensive,weapon,drugs,self-harm';
            
//             const response = await axios.get('https://api.sightengine.com/1.0/check.json', {
//                 params: {
//                     'url': imageUrlWithSas, // Use the temporary public URL
//                     'models': models_to_check,
//                     'api_user': sightengineApiUser,
//                     'api_secret': sightengineApiSecret
//                 }
//             });

//             const data = response.data;
//             const isAdult = (data.nudity.sexual_activity > 0.5 || data.nudity.explicit > 0.5 || data.nudity.suggestive > 0.8);
//             const isViolent = data.violence.prob > 0.5;
//             const isOffensive = data.offensive.prob > 0.5;
//             const isWeapon = data.weapon.prob > 0.5;
//             const isDrugs = data.drugs.prob > 0.5;
//             const isSelfHarm = data.self_harm.prob > 0.5;

//             const entity = {
//                 partitionKey: "images",
//                 rowKey: blobName,
//                 imageUrl: context.triggerMetadata.uri,
//                 isAdult: isAdult,
//                 isViolent: isViolent,
//                 isOffensive: isOffensive,
//                 isWeapon: isWeapon,
//                 isDrugs: isDrugs,
//                 isSelfHarm: isSelfHarm,
//                 sightengineResponse: JSON.stringify(data)
//             };

//             await tableClient.upsertEntity(entity, "Merge");
//             context.log(`[processImage] SUCCESS: Analysis for ${blobName} complete.`);

//         } catch (error) {
//             context.error(`[processImage] Error processing ${blobName}: ${error.message}`);
//         }
//     }
// });

// const { app } = require('@azure/functions');
// const { TableClient } = require("@azure/data-tables");
// const axios = require("axios");

// // NEW: Import the necessary clients and credentials for generating a SAS token
// const { BlobServiceClient, StorageSharedKeyCredential, BlobSASPermissions } = require("@azure/storage-blob");

// // NEW: Create a BlobServiceClient to interact with storage
// const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
// const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
// const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
// const blobServiceClient = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, sharedKeyCredential);
// const containerName = "images";

// // Create a client to connect to Azure Table Storage
// const tableClient = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "imageanalysis");

// app.storageBlob('processImage', {
//     path: 'images/{name}',
//     connection: 'AzureWebJobsStorage',
//     handler: async (blob, context) => {
//         const blobName = context.triggerMetadata.name;
//         context.log(`[processImage] Blob trigger function processing blob: ${blobName}`);

//         try {
//             // --- The Fix Starts Here ---
            
//             // NEW: Create a client for the specific blob that triggered the function
//             const blobClient = blobServiceClient.getContainerClient(containerName).getBlobClient(blobName);

//             // NEW: Generate a SAS URL that grants read-only access for 1 hour
//             const imageUrlWithSas = await blobClient.generateSasUrl({
//                 permissions: BlobSASPermissions.parse("r"), // "r" for read-only access
//                 expiresOn: new Date(new Date().valueOf() + 3600 * 1000), // 1 hour from now
//             });
            
//             // --- The Fix Ends Here ---

//             const sightengineApiUser = process.env.SIGHTENGINE_API_USER;
//             const sightengineApiSecret = process.env.SIGHTENGINE_API_SECRET;
            
//             // MODIFIED: Use the new SAS URL to call Sightengine
//             const response = await axios.get('https://api.sightengine.com/1.0/check.json', {
//                 params: { 
//                     'url': imageUrlWithSas, // Use the temporary, accessible URL
//                     'models': 'nudity-2.0', 
//                     'api_user': sightengineApiUser, 
//                     'api_secret': sightengineApiSecret 
//                 }
//             });

//             const nudity = response.data.nudity;
//             const isAdult = nudity.sexual_activity > 0.5 || nudity.explicit > 0.5 || nudity.suggestive > 0.8;

//             const entity = {
//                 partitionKey: "images",
//                 rowKey: blobName,
//                 imageUrl: context.triggerMetadata.uri, // Store the original, private URL
//                 isAdult: isAdult,
//                 sightengineResponse: JSON.stringify(response.data)
//             };

//             await tableClient.upsertEntity(entity, "Merge");
//             context.log(`[processImage] SUCCESS: Analysis for ${blobName} complete. Is Adult: ${isAdult}`);

//         } catch (error) {
//             // This will now catch any real errors from Sightengine
//             context.error(`[processImage] Error processing ${blobName}: ${error.message}`);
//         }
//     }
// });

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
