#!/bin/bash
cd libvpx
./configure \
    --prefix="$BUILD_ROOT" \
    --disable-examples \
    --disable-unit-tests \
    --enable-vp9-highbitdepth 
    --as=yasm
make -j $THREADS
make install