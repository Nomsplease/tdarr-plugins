/* eslint no-plusplus: ["error", { "allowForLoopAfterthoughts": true }] */
function details() {
  return {
    id: 'Tdarr_Plugin_Noms_CleanAudioStreams',
    Stage: 'Pre-processing',
    Name: 'Noms Clean audio streams',
    Type: 'Audio',
    Operation: 'Clean',
    Description: 'This plugin keeps only specified language tracks & removes tracks with  an unknown language. \n\n',
    Version: '1.0',
    Link: '',
    Tags: 'pre-processing,ffmpeg,audio only,configurable',
    Inputs: [{
      name: 'language',
      tooltip: `Specify language tag/s here for the audio tracks you'd like to keep
                \\nMust follow ISO-639-2 3 letter format. https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes
                \\nExample:\\n
                eng,und,jap`,
    },
    {
      name: 'keep_commentary',
      tooltip: `Specify if audio tracks that contain commentary/description should be removed.
                \\nExample:\\n
                true,false`,
    },
    {
      name: 'und_tag_lang',
      tooltip: `Specify language tag here for any unknown tracks. We will only use this if we only have one audio stream.
                \\nMust follow ISO-639-2 3 letter format. https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes
                \\nExample:\\n
                eng`,
    }
    ],
  };
}

function plugin(file, librarySettings, inputs) {
  const response = {
    processFile: false,
    preset: '',
    container: `.${file.container}`,
    handBrakeMode: false,
    FFmpegMode: true,
    reQueueAfter: false,
    infoLog: '',
  };

  // Check if file is a video. If it isn't then exit plugin.
  if (file.fileMedium !== 'video') {
    // eslint-disable-next-line no-console
    console.log('File is not video');
    response.infoLog += '☒File is not video \n';
    response.processFile = false;
    return response;
  }

  // Check if inputs.language has been configured. If it hasn't then exit plugin.
  if (inputs.language === '') {
    response.infoLog += '☒Language/s options not set, please configure required options. Skipping this plugin.  \n';
    response.processFile = false;
    return response;
  }

  // Set up required variables.
  const language = inputs.language.split(',');
  let ffmpegCommandInsert = '';
  let convert = false;
  let audioIdx = 0;
  let audioStreamsRemoved = 0;
  const audioStreamCount = file.ffProbeData.streams.filter(
    (row) => row.codec_type.toLowerCase() === 'audio',
  ).length;

  for (let i = 0; i < file.ffProbeData.streams.length; i++) {
    try {
      //If we only have one audio stream, taggin as we cannot remove it with the configured language.
      if ( audioStreamCount <= 1 ) {
        try {
          if (
            typeof file.ffProbeData.streams[i].tags.language === 'undefined'
            || file.ffProbeData.streams[i].tags.language.toLowerCase().includes('und')
            && file.ffProbeData.streams[i].codec_type.toLowerCase() === 'audio'
          ) {
            if (file.ffProbeData.streams[i].channels === 8) {
              if (typeof file.ffProbeData.streams[i].tags.title === 'undefined' || file.ffProbeData.streams[i].tags.title === 'und') {
                ffmpegCommandInsert += `-metadata:s:a:${audioIdx} title="7.1" `;
                response.infoLog += `☒Audio stream detected as 8 channel with no title, tagging. Stream 0:a:${audioIdx} as ${inputs.und_tag_lang} \n`;
                convert = true;
                reQueueAfter = true;
              } 
              if (typeof file.ffProbeData.streams[i].tags.language === 'undefined' || file.ffProbeData.streams[i].tags.language !== "eng"){
                ffmpegCommandInsert += `-metadata:s:a:${audioIdx} language=${inputs.und_tag_lang} `;
                response.infoLog += `☒Audio stream detected as having no language, tagging as ${inputs.und_tag_lang}. \n`;
                convert = true;
                reQueueAfter = true;
              }
            }
            if (file.ffProbeData.streams[i].channels === 6) {
              if (typeof file.ffProbeData.streams[i].tags.title === 'undefined' || file.ffProbeData.streams[i].tags.title === 'und') {
                ffmpegCommandInsert += `-metadata:s:a:${audioIdx} title="5.1"`;
                response.infoLog += `☒Audio stream detected as 6 channel with no title, tagging. Stream 0:a:${audioIdx} as ${inputs.und_tag_lang} \n`;
                convert = true;
                reQueueAfter = true;
              }
              if (typeof file.ffProbeData.streams[i].tags.language === 'undefined' || file.ffProbeData.streams[i].tags.language !== "eng") {
                ffmpegCommandInsert += `-metadata:s:a:${audioIdx} language=${inputs.und_tag_lang} `;
                response.infoLog += `☒Audio stream detected as having no language, tagging as ${inputs.und_tag_lang}. \n`;
                convert = true;
                reQueueAfter = true;
              }
            }
            if (file.ffProbeData.streams[i].channels === 2) {
              if (typeof file.ffProbeData.streams[i].tags.title === 'undefined' || file.ffProbeData.streams[i].tags.title === 'und') {
                ffmpegCommandInsert += `-metadata:s:a:${audioIdx} title="2.0" `;
                response.infoLog += `☒Audio stream detected as 2 channel with no title, tagging. Stream 0:a:${audioIdx} as ${inputs.und_tag_lang} \n`;
                convert = true;
                reQueueAfter = true;
              } 
              if (typeof file.ffProbeData.streams[i].tags.language === 'undefined' || file.ffProbeData.streams[i].tags.language !== "eng") {
                ffmpegCommandInsert += `-metadata:s:a:${audioIdx} language=${inputs.und_tag_lang} `;
                response.infoLog += `☒Audio stream detected as having no language, tagging as ${inputs.und_tag_lang}. \n`;
                convert = true;
                reQueueAfter = true;
              }
            }
          }
        } catch (err) {
          // Error
        }
      } else {

      let removeThisStream = false;
      try {
        if (
          file.ffProbeData.streams[i].codec_type.toLowerCase() === 'audio'
          && language.indexOf(
            file.ffProbeData.streams[i].tags.language.toLowerCase(),
          ) === -1
          && removeThisStream === false
        ) {
          audioStreamsRemoved += 1;
          removeThisStream = true;
          ffmpegCommandInsert += `-map -0:a:${audioIdx} `;
          response.infoLog += `☒Audio stream detected as being unwanted, removing. Audio stream 0:a:${audioIdx} \n`;
          convert = true;
        }
      } catch (err) {
        // Error
      }

      try {
        if (
          inputs.keep_commentary.toLowerCase() === 'false'
          && file.ffProbeData.streams[i].codec_type.toLowerCase() === 'audio'
          && (file.ffProbeData.streams[i].tags.title
            .toLowerCase()
            .includes('commentary')
            || file.ffProbeData.streams[i].tags.title
              .toLowerCase()
              .includes('description')
            || file.ffProbeData.streams[i].tags.title.toLowerCase().includes('sdh'))
            && removeThisStream === false
        ) {
          audioStreamsRemoved += 1;
          removeThisStream = true;
          ffmpegCommandInsert += `-map -0:a:${audioIdx} `;
          response.infoLog += `☒Audio stream detected as being commentary, removing. Stream 0:a:${audioIdx} \n`;
          convert = true;
        }
      } catch (err) {
        // Error
      }

      if (file.ffProbeData.streams[i].codec_type.toLowerCase() === 'audio') {
        try {
          if (file.ffProbeData.streams[i].tags.language.toLowerCase().includes('und') && removeThisStream === false) {
            audioStreamsRemoved += 1;
            removeThisStream = true;
            ffmpegCommandInsert += `-map -0:a:${audioIdx} `;
            response.infoLog += `☒Audio stream detected as having no language, removing. Audio stream 0:a:${audioIdx} \n`;
            convert = true;
          }
        } catch (err) {
          // Error
        }

        if (typeof file.ffProbeData.streams[i].tags === 'undefined' && removeThisStream === false) {
          audioStreamsRemoved += 1;
          removeThisStream = true;
          ffmpegCommandInsert += `-map -0:a:${audioIdx} `;
          response.infoLog += `☒Audio stream detected as having no language, removing. Audio stream 0:a:${audioIdx} \n`;
          convert = true;
        } else if (typeof file.ffProbeData.streams[i].tags.language === 'undefined' && removeThisStream === false) {
          audioStreamsRemoved += 1;
          removeThisStream = true;
          ffmpegCommandInsert += `-map -0:a:${audioIdx} `;
          response.infoLog += `☒Audio stream detected as having no language, removing. Audio stream 0:a:${audioIdx} \n`;
          convert = true;
        }
      }

      // Check if stream type is audio and increment audioIdx if true.
      if (file.ffProbeData.streams[i].codec_type.toLowerCase() === 'audio') {
        audioIdx += 1;
      }
      }
    } catch(err) {

    }
  }

  // Failsafe to cancel processing if all streams would be removed following this plugin. We don't want no audio.
  if (audioStreamsRemoved === audioStreamCount) {
    response.infoLog += `⚠ We have ${audioStreamCount} and we were attempting to remove ${audioStreamsRemoved}`
    response.infoLog += '☒Cancelling plugin otherwise all audio tracks would be removed. \n';
    response.processFile = false;
    return response;
  }

  // Convert file if convert variable is set to true.
  if (convert === true) {
    response.processFile = true;
    response.preset = `, -map 0 ${ffmpegCommandInsert} -c copy -max_muxing_queue_size 9999`;
    response.container = `.${file.container}`;
    response.reQueueAfter = true;
  } else {
    response.processFile = false;
    response.infoLog += "☑File doesn't contain audio tracks which are unwanted.\n";
  }
  return response;
}
module.exports.details = details;
module.exports.plugin = plugin;
