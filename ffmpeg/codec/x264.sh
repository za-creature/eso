#!/bin/bash
cd x264
./configure \
    --prefix="$BUILD_ROOT" \
    --bindir="$BUILD_ROOT/bin" \
    --enable-static \
    --enable-pic
make -j $THREADS
make install
