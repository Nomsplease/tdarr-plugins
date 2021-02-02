/* eslint no-plusplus: ["error", { "allowForLoopAfterthoughts": true }] */
function details() {
  return {
    id: 'Tdarr_Plugin_Noms_NVENC_HEVC',
    Stage: 'Pre-processing',
    Name: 'Migz-Transcode Using Nvidia GPU & FFMPEG',
    Type: 'Video',
    Operation: 'Transcode',
    Description: `Files not in H265 will be transcoded into H265 using Nvidia GPU with ffmpeg.
                  Settings are dependant on file bitrate, and will not cut bitrate below 4000kbps. \n
                  Bitrate x Multiplier: >10000=2x, 10000-6000=1.75x, 6000-4000=1.5x, <4000=1x \n
                  NVDEC & NVENC compatable GPU required. \n
                  This plugin will skip any files that are in the VP9 codec. \n`,
    Version: '3.0',
    Link: 'https://github.com/HaveAGitGat/Tdarr_Plugins/blob/master/Community/Tdarr_Plugin_MC93_Migz1FFMPEG.js',
    Tags: 'pre-processing,ffmpeg,video only,nvenc h265,configurable',
    Inputs: [{
      name: 'container',
      tooltip: `Specify output container of file
                \\n Ensure that all stream types you may have are supported by your chosen container.
                \\n mkv is recommended.
                    \\nExample:\\n
                    mkv

                    \\nExample:\\n
                    mp4`,
    },
    ],
  };
}

function plugin(file, librarySettings, inputs) {
  const response = {
    processFile: false,
    preset: '',
    handBrakeMode: false,
    FFmpegMode: true,
    reQueueAfter: true,
    infoLog: '',
  };

  let duration = '';

  // Check if inputs.container has been configured. If it hasn't then exit plugin.
  if (inputs.container === '') {
    response.infoLog += '☒Plugin has not been configured, please configure required options. Skipping this plugin. \n';
    response.processFile = false;
    return response;
  }
  response.container = `.${inputs.container}`;

  // Check if file is a video. If it isn't then exit plugin.
  if (file.fileMedium !== 'video') {
    response.processFile = false;
    response.infoLog += '☒File is not a video. \n';
    return response;
  }

  //Get our file duration for bitrate calculation
  if (typeof file.meta.Duration !== 'undefined') {
    duration = file.meta.Duration * 0.0166667;
  } else {
    duration = file.ffProbeData.streams[0].duration * 0.0166667;
  }

  // Set up required variables.
  let videoIdx = 0;
  let CPU10 = false;
  let extraArguments = '';
  let bitrateSettings = '';

  // Setup our Bitrates
  const currentBitRate = ~~(file.file_size / (duration * 0.0075));
  const bitRateMinMultiplier = 0.7;
  const bitRateMaxMultiplier = 1.3;
  var bitRateTargetMultiplier = 1;
  if ( currentBitRate > 10000 ) {
    bitRateTargetMultiplier = 2;
  } else if (currentBitRate < 10000 && currentBitRate > 6000) {
    bitRateTargetMultiplier = 1.75;
  } else if ( currentBitRate < 6000 && currentBitRate > 4000 ) {
    bitRateTargetMultiplier = 1.5;
  } else if ( currentBitRate < 4000 ) {
    bitRateTargetMultiplier = 1;
  } 

  const targetBitrate = ~~(currentBitRate / bitRateTargetMultiplier);
  const minimumBitrate = ~~(targetBitrate * bitRateMinMultiplier);
  const maximumBitrate = ~~(targetBitrate * bitRateMaxMultiplier);

  // If targetBitrate comes out as 0 then something has gone wrong and bitrates could not be calculated.
  // Cancel plugin completely.
  if (targetBitrate === 0) {
    response.processFile = false;
    response.infoLog += '☒Target bitrate could not be calculated. Skipping this plugin. \n';
    return response;
  }

  // Go through each stream in the file.
  for (let i = 0; i < file.ffProbeData.streams.length; i++) {
    // Check if stream is a video.
    if (file.ffProbeData.streams[i].codec_type.toLowerCase() === 'video') {
      // Check if codec of stream is mjpeg/png, if so then remove this "video" stream.
      // mjpeg/png are usually embedded pictures that can cause havoc with plugins.
      if (file.ffProbeData.streams[i].codec_name === 'mjpeg' || file.ffProbeData.streams[i].codec_name === 'png') {
        extraArguments += `-map -v:${videoIdx} `;
      }
      // Check if codec of stream is hevc or vp9 AND check if file.container matches inputs.container.
      // If so nothing for plugin to do.
      if (
        (
          file.ffProbeData.streams[i].codec_name === 'hevc'
          || file.ffProbeData.streams[i].codec_name === 'vp9'
        )
                && file.container === inputs.container
      ) {
        response.processFile = false;
        response.infoLog += `☑File is already hevc or vp9 & in ${inputs.container}. \n`;
        return response;
      }
      // Check if codec of stream is hevc or vp9
      // AND check if file.container does NOT match inputs.container.
      // If so remux file.
      if (
        (
          file.ffProbeData.streams[i].codec_name === 'hevc'
           || file.ffProbeData.streams[i].codec_name === 'vp9'
        )
                && file.container !== inputs.container
      ) {
        response.infoLog += `☒File is hevc or vp9 but is not in ${inputs.container} container. Remuxing. \n`;
        response.preset = `, -map 0 -c copy ${extraArguments}`;
        response.processFile = true;
        return response;
      }

      // Check if video stream is HDR or 10bit
      if (
        file.ffProbeData.streams[i].profile === 'High 10'
            || file.ffProbeData.streams[i].bits_per_raw_sample === '10'
      ) {
        CPU10 = true;
        extraArguments += '-pix_fmt p010le ';
      }

      // Increment videoIdx.
      videoIdx += 1;
    }
  }

  // Set bitrateSettings variable using bitrate information calulcated earlier.
  bitrateSettings = `-b:v ${targetBitrate}k -minrate ${minimumBitrate}k `
  + `-maxrate ${maximumBitrate}k -bufsize ${currentBitRate}k`;
  // Print to infoLog information around file & bitrate settings.
  response.infoLog += `Container for output selected as ${inputs.container}. \n`;
  response.infoLog += `Current bitrate = ${currentBitRate} \n`;
  response.infoLog += 'Bitrate settings: \n';
  response.infoLog += `Target = ${targetBitrate} \n`;
  response.infoLog += `Minimum = ${minimumBitrate} \n`;
  response.infoLog += `Maximum = ${maximumBitrate} \n`;

  // Codec will be checked so it can be transcoded correctly
  if (file.video_codec_name === 'h263') {
    response.preset = '-c:v h263_cuvid';
  } else if (file.video_codec_name === 'h264') {
    if (CPU10 === false) {
      response.preset = '-c:v h264_cuvid';
    }
  } else if (file.video_codec_name === 'mjpeg') {
    response.preset = 'c:v mjpeg_cuvid';
  } else if (file.video_codec_name === 'mpeg1') {
    response.preset = '-c:v mpeg1_cuvid';
  } else if (file.video_codec_name === 'mpeg2') {
    response.preset = '-c:v mpeg2_cuvid';
  } else if (file.video_codec_name === 'vc1') {
    response.preset = '-c:v vc1_cuvid';
  } else if (file.video_codec_name === 'vp8') {
    response.preset = '-c:v vp8_cuvid';
  }

  response.preset += `,-map 0 -c:v hevc_nvenc -rc:v vbr_hq -cq:v 19 ${bitrateSettings} `
  + `-spatial_aq:v 1 -rc-lookahead:v 32 -c:a copy -c:s copy -max_muxing_queue_size 9999 ${extraArguments}`;
  response.processFile = true;
  response.infoLog += '☒File is not hevc or vp9. Transcoding. \n';
  return response;
}
module.exports.details = details;
module.exports.plugin = plugin;
