#!/bin/bash
cd ffmpeg
./configure \
    --prefix="$BUILD_ROOT" \
    --pkg-config-flags="--static" \
    --extra-cflags="-I$BUILD_ROOT/include" \
    --extra-ldflags="-L$BUILD_ROOT/lib" \
    --extra-libs="-lpthread -lm" \
    --bindir="$BUILD_ROOT/bin" \
    --disable-optimizations \
    --enable-gpl \
    --enable-version3 \
    --enable-nonfree \
    --enable-libdav1d \
    --enable-libdavs2 \
    --enable-libfdk-aac \
    --enable-libopus \
    --enable-libspeex \
    --enable-libtheora \
    --enable-libvorbis \
    --enable-libvpx \
    --enable-libx264 \
    --enable-openssl
make -j $THREADS
make install
mv $BUILD_ROOT/bin/ffmpeg $BUILD_ROOT/out/ffmpeg
upx $BUILD_ROOT/out/ffmpeg