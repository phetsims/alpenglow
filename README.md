alpenglow
=======

Experimental rasterization engine, by PhET Interactive Simulations

### License

MIT license, see [LICENSE](LICENSE)

### Contributing

If you would like to contribute to this repo, please read
our [contributing guidelines](https://github.com/phetsims/community/blob/main/CONTRIBUTING.md).

### Minimal Setup Instructions

```sh
# The repo itself
git clone https://github.com/phetsims/alpenglow.git

# Dependencies (at the time of writing)
git clone https://github.com/phetsims/assert.git
git clone https://github.com/phetsims/axon.git
git clone https://github.com/phetsims/chipper.git
git clone https://github.com/phetsims/dot.git
git clone https://github.com/phetsims/kite.git
git clone https://github.com/phetsims/perennial.git perennial-alias
git clone https://github.com/phetsims/phet-core.git
git clone https://github.com/phetsims/phetcommon.git
git clone https://github.com/phetsims/scenery.git
git clone https://github.com/phetsims/sherpa.git
git clone https://github.com/phetsims/tandem.git
git clone https://github.com/phetsims/utterance-queue.git

# Get NPM dependencies
cd perennial-alias
npm install
cd ../chipper
npm install
cd ../alpenglow
npm install

# Start transpilation watch process (skip --live to just run once, if not can Ctrl-C out as desired).
cd ../chipper
grunt transpile --live
```

### Viewing Plan and Documentation

Go to http://localhost/alpenglow/doc/ (or an equivalent) to browse, where the document root is the directory with all of
the repositories checked out.

### Running (experimental) Thimbleberry WGSL benchmarks

```sh
# Go to the alpenglow directory
cd ../alpenglow

# (on macOS) open Chrome with the appropriate flags
open -a "Google Chrome Canary" --args --enable-dawn-features=allow_unsafe_apis --enable-webgpu-developer-features --disable-dawn-features=timestamp_quantization

# browse to http://localhost:5173/alpenglow/tests/bench-thimbleberry.html
```
