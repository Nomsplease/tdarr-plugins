/* eslint-disable */
function details() {
  return {
    id: "Tdarr_Plugin_Noms_AIO_LibraryConverter",
    Name: "Noms AIO Media Cleanup [NVENC]",
    Stage: "Pre-processing",
    Type: "Video",
    Operation: "Transcode",
    Description:
      "[Single Pass] Single pass script aimed to do a single transcode proccess to save time. This merges every other plugin from Noms under one roof. Every option is required. Pulled a lot from drdd, and Migz.",
    Version: "1.0",
    Tags: "pre-processing, ffmpeg, subtitle, audio, video, nvenc h265",
    Inputs: [
      {
        name: 'subtitle_language',
        tooltip: `Specify language tag/s here for the subtitle tracks you'd like to keep.
                  \\nMust follow ISO-639-2 3 letter format. https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes
                  \\nExample:\\n
                  eng,jap`,
      },
      {
        name: 'subtitle_keep_commentary',
        tooltip: `Specify if subtitle tracks that contain commentary/description should be removed.
                  \\nExample:\\n
                  true,false`,
      },
      {
        name: 'subtitle_remove_unknown',
        tooltip: `Specify if subtitle tracks that have no language should be removed.
                  \\nExample:\\n
                  true,false`,
      },
      {
        name: 'audio_language',
        tooltip: `Specify language tag/s here for the audio tracks you'd like to keep
                  \\nMust follow ISO-639-2 3 letter format. https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes
                  \\nExample:\\n
                  eng,und,jap`,
      },
      {
        name: 'audio_keep_commentary',
        tooltip: `Specify if audio tracks that contain commentary/description should be removed.
                  \\nExample:\\n
                  true,false`,
      },
      {
        name: 'audio_undtermined_track_tag',
        tooltip: `Specify language tag here for any unknown tracks. We will only use this if we only have one audio stream and need to tag it for further processing.
                  \\nMust follow ISO-639-2 3 letter format. https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes
                  \\nExample:\\n
                  eng`,
      },
      {
        name: 'container',
        tooltip: `Specify output container of file
                  \\n Ensure that all stream types you may have are supported by your chosen container.
                  \\n mkv is recommended.
                      \\nExample:\\n
                      mkv`,        
      },
    ],
  };
}

function plugin(file, librarySettings, inputs) {
  //Response variable
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

  // Check for inputs
  try {
    if (inputs.subtitle_language === '') {
      response.infoLog += '☒ subtitle_language options not set, please configure all options. \n';
      response.processFile = false;
      return response;
    }
    if (inputs.subtitle_keep_commentary === '') {
      response.infoLog += '☒ subtitle_keep_commentary options not set, please configure all options. \n';
      response.processFile = false;
      return response;
    }
    if (inputs.subtitle_remove_unknown === '') {
      response.infoLog += '☒ subtitle_remove_unknown options not set, please configure all options. \n';
      response.processFile = false;
      return response;
    }
    if (inputs.audio_language === '') {
      response.infoLog += '☒ audio_language options not set, please configure all options. \n';
      response.processFile = false;
      return response;
    }
    if (inputs.audio_keep_commentary === '') {
      response.infoLog += '☒ audio_keep_commentary options not set, please configure all options. \n';
      response.processFile = false;
      return response;
    }
    if (inputs.audio_undtermined_track_tag === '') {
      response.infoLog += '☒ audio_undtermined_track_tag options not set, please configure all options. \n';
      response.processFile = false;
      return response;
    }
    if (inputs.container === '') {
      response.infoLog += '☒ container options not set, please configure all options. \n';
      response.processFile = false;
      return response;
    }
  } catch(err) {
    response.infoLog += `☒ Settings not configured. Every setting is required. \n`
  }

  //Subtitle Variables
  const language = inputs.language.split(',');
  let ffmpegCommandInsert = '';
  let convert = false;
  let audioIdx = 0;
  let audioStreamsRemoved = 0;
  const audioStreamCount = file.ffProbeData.streams.filter((row) => row.codec_type.toLowerCase() === 'audio',).length;

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
