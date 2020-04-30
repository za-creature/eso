#!/bin/bash
cd nasm
./autogen.sh
./configure \
    --prefix="$BUILD_ROOT" \
    --bindir="$BUILD_ROOT/bin"
make -j $THREADS
make install
