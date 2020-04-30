#!/bin/bash
cd davs2/build/linux
./configure \
    --prefix="$BUILD_ROOT" \
    --disable-shared
make -j $THREADS
make install
sed -i 's/1\.6\./1\.6\.0/' $BUILD_ROOT/lib/pkgconfig/davs2.pc 
