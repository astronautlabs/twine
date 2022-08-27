# @/twine
[![NPM](https://img.shields.io/npm/v/@astronautlabs/twine.svg)](https://www.npmjs.com/package/@astronautlabs/twine)


A tool for distributing binary artifacts for Node.js native addons.

# Introduction

Twine is entirely convention based which allows the tool to be extremely minimal and easy to set up.
The artifact uploaded/downloaded will be based on inferred properties of the environment Twine is run from. 

Artifacts are named in the following manner:

```ts
// pkg is your package JSON
// buildType is Debug or Release
`${pkg.name}@${pkg.version}.${process.platform}-${process.arch}-${buildType}.zip`
```

Each artifact consists of a Zip archive of the contents of `build/Debug` or `build/Release`, depending on the 
build type.

Twine will also automatically skip building when you run `npm install` from within your working copy during 
development.

# Usage

Add the following scripts to your `package.json`:

```json
"scripts": {
    "install": "twine install",
    "twine:publish": "twine publish",
    "build:native": "<your native build command here>"
}
```

Also add a `"twine"` section to your `package.json`:

```json
"twine": {
    "distributionUrl": "https://my-downloads.example.com",
    "moduleName": "my-native-addon"  // ie: as in build/Release/my-native-addon.node
}
```

To publish an artifact, first build your module:
```
npm run build:native
```

You would then want to do any testing or other validation on the resulting build.

Add a `.env` file in your project root, or provide the equivalent environment variables to the publish command.
**Important**: Make sure `.env` is excluded from version control and publishing using `.gitignore` AND `.npmignore`.

```
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET=my-bucket-name
S3_ENDPOINT=https://my-s3-endpoint.example.com
```

Note, if you are using AWS S3, S3_ENDPOINT should be `https://s3.<region>.amazonaws.com`.
* Do not include the bucket name in this URL.

Now publish your build using twine:

```
npm run twine:publish
```

# Using subfolders

If you wish to publish artifacts into a specific folder (and download from that folder), you can do so by modifying your
`twine.distributionUrl` and specifying the `S3_FOLDER` environment variable while publishing, like so:

```json
"twine": {
    "distributionUrl": "https://my-downloads.example.com/my-project",
    "moduleName": "my-project"
}
```

```bash
S3_FOLDER=my-project
```

This works with multiple levels of folders, for instance `S3_FOLDER=my-org/my-project/my-branch` provided that you 
ensure `distributionUrl` matches.

# Distributing artifacts inline

Twine supports distributing artifacts inline within your NPM package. Twine will look for artifacts within the 
`.twine` folder, and if a matching one exists, it will be unpacked to the appropriate location within the `build/` folder
during install-time.

You can download all existing prebuilt artifacts from your distribution server using `twine pack`. If you wish to enforce
that only packed artifacts will be used at installation time, you can set the `twine.packOnly` property in your `package.json`
to `true`.