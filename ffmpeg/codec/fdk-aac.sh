#!/bin/bash
cd fdk-aac
autoreconf -fiv
./configure \
    --prefix="$BUILD_ROOT" \
    --disable-shared
make -j $THREADS
make install
