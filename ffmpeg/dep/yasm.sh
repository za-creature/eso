#!/bin/bash
cd yasm
./configure \
    --prefix="$BUILD_ROOT" \
    --bindir="$BUILD_ROOT/bin"
make -j $THREADS
make install
