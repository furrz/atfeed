# atfeed

This is an implementation of a Bluesky Feed Generator for the serverless platform Vercel.
It is configurable to provide any number of feeds which show the latest posts from a
selection of users.

This implementation's official instance is [feed.zyntaks.ca](https://feed.zyntaks.ca).

## Technical Details

Unlike the official reference implementation of a feed generator, atfeed doesn't continuously
consume the bluesky 'firehose' of posts. Instead, due to its serverless nature, it requests
posts on-demand whenever a feed is requested of it. This means feeds run on this generator are
potentially slower to load, but likely cheaper to operate as well.

## Porting

It should be easy to adapt to other serverless platforms, if you wish to do so - simply
replace the "vercel KV" library with a regular redis library and adjust the entry-points
of each page.
