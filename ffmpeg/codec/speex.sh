cd speex
./autogen.sh
./configure \
    --prefix="$BUILD_ROOT" \
    --disable-shared
make -j $THREADS
make install
