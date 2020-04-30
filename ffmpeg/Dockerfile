# hygiene
FROM gcr.io/google-appengine/nodejs
RUN apt-get -y update
WORKDIR /root


# build tools
RUN apt-get -y install autogen \
                       autotools-dev \
                       dh-autoreconf \
                       libssl-dev \
                       ninja-build \
                       pkg-config \
                       python3-pip \
                       upx \
                       wget
RUN pip3 install meson==0.47


# dependencies
RUN wget https://www.nasm.us/pub/nasm/releasebuilds/2.14.02/nasm-2.14.02.tar.xz
RUN tar xJvf nasm-2.14.02.tar.xz && mv nasm-2.14.02 nasm
RUN wget https://www.tortall.net/projects/yasm/releases/yasm-1.3.0.tar.gz
RUN tar xzvf yasm-1.3.0.tar.gz && mv yasm-1.3.0 yasm
RUN git clone --depth 1 --single-branch -b 'v1.3.4' https://github.com/xiph/ogg.git


# codecs
RUN git clone --depth 1 --single-branch -b '0.6.0' https://code.videolan.org/videolan/dav1d.git
RUN git clone --depth 1 --single-branch -b '1.6' https://github.com/pkuvcl/davs2.git
RUN git clone --depth 1 --single-branch -b 'v2.0.1' https://github.com/mstorsjo/fdk-aac
RUN git clone --depth 1 --single-branch -b 'v1.3.1' https://github.com/xiph/opus.git
RUN git clone --depth 1 --single-branch -b 'Speex-1.2.0' https://github.com/xiph/speex.git
RUN git clone --depth 1 --single-branch -b 'v1.1.1' https://github.com/xiph/theora.git
RUN git clone --depth 1 --single-branch -b 'v1.3.6' https://github.com/xiph/vorbis.git
RUN git clone --depth 1 --single-branch -b 'v1.8.2' https://chromium.googlesource.com/webm/libvpx.git
RUN git clone --depth 1 --single-branch -b 'master' https://code.videolan.org/videolan/x264.git


# ffmpeg
RUN wget https://ffmpeg.org/releases/ffmpeg-4.2.2.tar.bz2
RUN tar xjvf ffmpeg-4.2.2.tar.bz2 && mv ffmpeg-4.2.2 ffmpeg


# config
ENV BUILD_ROOT '/var/task'
ENV THREADS 16


# on a roll like timmy
RUN mkdir -p $BUILD_ROOT
ENV PKG_CONFIG_PATH $BUILD_ROOT/lib/pkgconfig
ENV PATH $BUILD_ROOT/bin:$PATH
COPY . /root
CMD /bin/bash
