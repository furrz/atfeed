import {DidResolver} from "@atproto/did-resolver";

new DidResolver({ plcUrl: 'https://plc.directory' }).resolveDidNoCheck(process.argv[2])
    .then(r => console.log(r));
