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

/**
 * Handles logging in a standardised way.
 */
class Log {
  constructor() {
    this.entries = [];
  }

  /**
   *
   * @param {String} entry the log entry string
   */
  Add(entry) {
    this.entries.push(entry);
  }

  /**
   *
   * @param {String} entry the log entry string
   */
  AddSuccess(entry) {
    this.entries.push(`☑ ${entry}`);
  }

  /**
   *
   * @param {String} entry the log entry string
   */
  AddWarning(entry) {
    this.entries.push(`⚠ ${entry}`)
  }

  /**
   *
   * @param {String} entry the log entry string
   */
  AddError(entry) {
    this.entries.push(`☒ ${entry}`);
  }

  /**
   * Returns the log lines separated by new line delimiter.
   */
  GetLogData() {
    return this.entries.join("\n");
  }
}

/**
 * Handles the storage of FFmpeg configuration.
 */
class Configurator {
  constructor(defaultOutputSettings = null) {
    this.shouldProcess = false;
    this.outputSettings = defaultOutputSettings || [];
    this.inputSettings = [];
  }

  AddInputSetting(configuration) {
    this.inputSettings.push(configuration);
  }

  AddOutputSetting(configuration) {
    this.shouldProcess = true;
    this.outputSettings.push(configuration);
  }

  RemoveOutputSetting(configuration) {
    var index = this.outputSettings.indexOf(configuration);

    if (index === -1) return;
    this.outputSettings.splice(index, 1);
  }

  GetOutputSettings() {
    return this.outputSettings.join(" ");
  }

  GetInputSettings() {
    return this.inputSettings.join(" ");
  }
}

function inputValidation(inputs,logger) {
  try {
    if (inputs.subtitle_language === '') {
      logger.AddError(`subtitle_language options not set, please configure all options.`);
      return false;
    }
    if (inputs.subtitle_keep_commentary === '') {
      logger.AddError(`subtitle_keep_commentary options not set, please configure all options.`);
      return false;
    }
    if (inputs.subtitle_remove_unknown === '') {
      logger.AddError(`subtitle_remove_unknown options not set, please configure all options.`);
      return false;
    }
    if (inputs.audio_language === '') {
      logger.AddError(`audio_language options not set, please configure all options.`);
      return false;
    }
    if (inputs.audio_keep_commentary === '') {
      logger.AddError(`audio_keep_commentary options not set, please configure all options.`);
      return false;
    }
    if (inputs.container === '') {
      logger.AddError(`'container options not set, please configure all options.`);
      return false;
    }
  } catch(err) {
    logger.AddError(`Settings not configured. Every setting is required.`);
  }
}

function streamByTypeToArray(type,array,file,logger) {
  for (let i = 0; i < file.ffProbeData.streams.length; i++) {
    try {
      if (file.ffProbeData.streams[i].codec_type.toLowerCase() === type) {
        array.push(i);
      }
    } catch (err) {
      logger.AddError(`Hit error looking for ${type} in ${i} for array ${array}`)
    }
  }
}

function removeFromArray(array, stream) {
	const index = array.indexOf(array[stream]);
	array.splice(index, 1);
}

function subtitleUnknownFilter(inputs,array,file,logger,configuration) {
  if (inputs.subtitle_remove_unknown === "true") {
		for (stream in array) {
			try {
				if (typeof file.ffProbeData.streams[array[stream]].tags.language === "undefined"){
					logger.AddWarning(`Removing unknown subtitle at stream: ${array[stream]}`);
					configuration.AddOutputSetting(`-map -0:s:${array[stream]}`);
					removeFromArray(array, stream);
				} else if (file.ffProbeData.streams[array[stream]].tags.language.toLowerCase().includes('und')){
					logger.AddWarning(`Removing unknown subtitle at stream: ${array[stream]}`);
					configuration.AddOutputSetting(`-map -0:s:${array[stream]}`);
					removeFromArray(array, stream);
				} else {
					//If we hit here this subtitle has language or tag, and gets to move onto the next round
				}
			} catch (err) {
				logger.AddError(`Subtitle unknown loop hit an error on stream ${array[stream]}. Error: ${err}`)
			}
		}
  } else {
    logger.AddSuccess(`Removing of unkown subtitles has been disabled.`)
  }
}

function subtitleCommentaryFilter(inputs,array,file,logger,configuration) {
  if (inputs.subtitle_keep_commentary === "false") {
    for (stream in array) {
      try {
        if (file.ffProbeData.streams[array[stream]].tags.title.toLowerCase().includes('commentary')){
          logger.AddWarning(`Removing undesired commentary subtitle at stream: ${array[stream]}`);
					configuration.AddOutputSetting(`-map -0:s:${array[stream]}`);
					removeFromArray(array, stream);
        } else if (file.ffProbeData.streams[array[stream]].tags.title.toLowerCase().includes('description')){
          logger.AddWarning(`Removing undesired description subtitle at stream: ${array[stream]}`);
					configuration.AddOutputSetting(`-map -0:s:${array[stream]}`);
					removeFromArray(array, stream);
        } else {
          //If we hit here this subtitle is not unkown, and gets to move onto the next round

        }
      } catch (err) {
        logger.AddError(`Subtitle commentary loop hit an error on stream ${array[stream]}. Error: ${err}`)
      }
    }
  } else {
    logger.AddSuccess(`Removing of commentary subtitles has been disabled.`)
  }
}

function subtitleLanguageFilter(inputs,array,file,logger,configuration) {
  const language = inputs.subtitle_language.split(',');
  for (stream in array) {
    try {
      if (language.indexOf(file.ffProbeData.streams[array[stream]].tags.language.toLowerCase(),) === -1 ) {
        logger.AddWarning(`Removing subtitle with language ${file.ffProbeData.streams[array[stream]].tags.language}`)
				configuration.AddOutputSetting(`-map -0:s:${array[stream]}`);
				removeFromArray(array, stream);
      }
    } catch (err) {
      logger.AddError(`Subtitle Language loop hit an error on stream ${array[stream]}. Error: ${err}`);
    }
	}
} 

function runSubtitleFilters(inputs,array,file,logger) {
  let configuration = new Configurator(["-c:s copy"]);
  subtitleUnknownFilter(inputs,array,file,logger,configuration);
	subtitleCommentaryFilter(inputs,array,file,logger,configuration);
	subtitleLanguageFilter(inputs,array,file,logger,configuration);
  return configuration;
}

function audioUknownFilter(inputs,array,file,logger,configuration){
	inputs.aaudio_language
	if(array.length <= 1){
		
	}
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

  //Stream Indecies
  let audioStreams = [];
  let videoStreams = [];
  let subtitleStreams = [];

  //Global Variables
  var logger = new Log();
  let ffmpegCommandInsert = '';
  let convert = false;

  // Check if file is a video. If it isn't then exit plugin.
  if (file.fileMedium !== 'video') {
    // eslint-disable-next-line no-console
    console.log('File is not video');
    response.infoLog += '☒File is not video \n';
    response.processFile = false;
    return response;
  }

  // Check for inputs
	if (inputValidation(inputs,logger) === false) {
		response.infoLog += logger.GetLogData();
		return response;
	}

  //Subtitle Variables
  const language = inputs.subtitle_language.split(',');
  let audioIdx = 0;

  streamByTypeToArray("video", videoStreams, file)
  streamByTypeToArray("audio", audioStreams, file)
  streamByTypeToArray("subtitle", subtitleStreams, file)

  logger.AddSuccess(`Video streams are at: ${videoStreams}`);
  logger.AddSuccess(`Audio streams are at: ${audioStreams}`);
  logger.AddSuccess(`Subtitle streams are at: ${subtitleStreams}`);
  let subtitleConfiguration = runSubtitleFilters(inputs,subtitleStreams,file,logger);

  logger.AddWarning(`${subtitleConfiguration.GetInputSettings()},${subtitleConfiguration.GetOutputSettings()} -max_muxing_queue_size 4096`)
  logger.AddWarning('End Plugin');

  response.infoLog += logger.GetLogData();
  return response;
  response.processFile = false;
}
module.exports.details = details;
module.exports.plugin = plugin;
