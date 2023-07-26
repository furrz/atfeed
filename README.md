# atfeed

This is an implementation of a Bluesky Feed Generator for the serverless platform Vercel.
It is configurable to provide any number of feeds which show the latest posts from a
selection of users.

This implementation's official instance is [feed.zyntaks.ca](https://feed.zyntaks.ca).

## Technical Details

### Configuration

atfeed is configured through environment variables:

- `FEED_ENDPOINT`: The feed endpoint, e.g. `https://feed.zyntaks.ca/`.
- `FEED_DID`: The Feed DID. Should be `did:web:your.feedendpoint.domain`, such as `did:web:feed.zyntaks.ca`.
- `BSKY_USER`: Your bluesky username, without the `@`.
- `BSKY_PASSWORD`: Your bluesky password. Keep this safe in a secret manager, please.

Vercel KV environment variables (used by `@vercel/kv`, which can be swapped out for redis):
- `KV_URL`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`

### Management

A command-line utility, `npm run cli`, is used to create and edit feeds, including managing their
published information. Ensure your local .env file contains all the configuration environment variables.

### Performance

Unlike the official reference implementation of a feed generator, atfeed doesn't continuously
consume the bluesky 'firehose' of posts. Instead, due to its serverless nature, it requests
posts on-demand whenever a feed is requested of it. This means feeds run on this generator are
potentially slower to load, but likely cheaper to operate as well.

###  Porting

It should be easy to adapt to other serverless platforms, if you wish to do so - simply
replace the "vercel KV" library with a regular redis library and adjust the entry-points
of each page.
