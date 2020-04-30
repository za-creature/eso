for stage in 'dep' 'codec'
do
    for script in $(ls $stage/*);
    do
        bash $script &
    done
    wait
done


bash ffmpeg.sh && exit 0 || echo 'Whoops, looks like something went wrong.'
