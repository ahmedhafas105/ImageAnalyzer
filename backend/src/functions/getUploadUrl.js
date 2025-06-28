const { app } = require('@azure/functions');
const { BlobServiceClient, StorageSharedKeyCredential, BlobSASPermissions } = require("@azure/storage-blob");

const { verifyFirebaseToken } = require('../../auth-middleware');

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = "images";

const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
const blobServiceClient = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, sharedKeyCredential);

app.http('getUploadUrl', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`[getUploadUrl] HTTP trigger processed a request.`);
        const authResult = await verifyFirebaseToken(request, context);
        if (authResult.error) return authResult.error;
        try {
            const userId = authResult.user.uid;
            const originalFilename = request.query.get('blobName') || `${Date.now()}.jpg`;
            const blobName = `${userId}/${originalFilename}`;
            const blobClient = blobServiceClient.getContainerClient(containerName).getBlobClient(blobName);

            const sasTokenUrl = await blobClient.generateSasUrl({
                permissions: BlobSASPermissions.parse("wc"),
                expiresOn: new Date(new Date().valueOf() + 3600 * 1000),
            });
            
            return { body: JSON.stringify({ uploadUrl: sasTokenUrl }) };

        } catch (error) {
            // THE FIX IS HERE: Changed from context.log.error to context.error
            context.error(`[getUploadUrl] Error: ${error.message}`);
            return {
                status: 500,
                body: JSON.stringify({ message: "An error occurred while generating the upload URL." })
            };
        }
    }
});