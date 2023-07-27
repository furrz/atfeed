import type {VercelRequest, VercelResponse} from '@vercel/node';

export default async (request: VercelRequest, response: VercelResponse) => {
    response.status(200).json({
        "@context": [
            "https://www.w3.org/ns/did/v1"
        ],
        "id": process.env.FEED_DID!,
        "service": [
            {
                "id": "#bsky_fg",
                "serviceEndpoint": process.env.FEED_ENDPOINT,
                "type": "BskyFeedGenerator"
            }
        ]
    });
};
