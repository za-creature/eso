#!/bin/bash
cd dav1d
meson build \
    --buildtype=release \
    --default-library=static \
    --prefix="$BUILD_ROOT" \
    --libdir lib
cd build
meson configure
ninja -j $THREADS
ninja install
sed -i 's/-ldav1d/-ldav1d -ldl/' $BUILD_ROOT/lib/pkgconfig/dav1d.pc 
