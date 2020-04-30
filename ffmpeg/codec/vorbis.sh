#!/bin/bash
cd vorbis
./autogen.sh
./configure \
    --prefix="$BUILD_ROOT" \
    --exec-prefix="$BUILD_ROOT" \
    --disable-shared
make -j $THREADS
make install
