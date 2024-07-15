/* eslint-disable prettier/prettier */
export function restructureVideo(data): any {
    const resolutions = {
        "360": "360p",
        "480": "480p",
        "720": "720p"
    };

    const videoSources = {};

    data.forEach(url => {
        const match = url.match(/h_(\d+)/);
        if (match) {
            const resolution = match[1];
            if (resolutions[resolution]) {
                videoSources[resolutions[resolution]] = url;
            }
        }
    });

    return videoSources;
}
