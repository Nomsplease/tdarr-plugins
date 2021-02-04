/* eslint-disable */
function details() {
  return {
    id: "Tdarr_Plugin_Noms_AIO_LibraryConverter",
    Name: "Noms AIO Media Cleanup [NVENC]",
    Stage: "Pre-processing",
    Type: "Video",
    Operation: "Transcode",
    Description:
      "[Single Pass] Single pass script aimed to do a single transcode proccess to save time. This merges every other plugin from Noms under one roof. Pulled a lot from drdd, and Migz.",
    Version: "1.0",
    Tags: "pre-processing, ffmpeg, subtitle, audio, video, nvenc h265",
    Inputs: [
      {
        name: 'subtitle_language',
        tooltip: `Specify language tag/s here for the subtitle tracks you'd like to keep. If left empty all subtitle will be kept. Can use "none" to remove all.
                  \\nMust follow ISO-639-2 3 letter format. https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes
                  \\nExample:\\n
                  eng,jap`,
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
				name: 'audio_unknown_tag_lang',
				tooltip: `Specify language tag here for any unknown tracks. We will only use this if we only have one audio stream.
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
/**
 * Returns the duration of the file in minutes.
 */
function getFileDurationInMinutes(file) {
  return typeof file.meta.Duration != undefined
    ? file.meta.Duration * 0.0166667
    : file.ffProbeData.streams[0].duration * 0.0166667;
}
/**
 * Returns bitrate information.
 */
function calculateBitrate(
  file,
  divideBy = 2,
  minMultiplier = 0.8,
  maxMultiplier = 1.4
) {
  var duration = getFileDurationInMinutes(file);
  var original = ~~(file.file_size / (duration * 0.0075));

  // Change how much we cut the bitrate based on the original bitrate
  // of the file. When bitrate is already low, we don't want to lose
  // much more, but can still do a conversion.
  if (original < 10000 && original >= 6000) {
    divideBy = 1.75;
  }

  if (original < 6000) {
    divideBy = 1.5;
  }

  if (original < 3000) {
    divideBy = 1;
  }

  var target = ~~(original / divideBy);
  return {
    original: original,
    target: target,
    min: ~~(target * minMultiplier),
    max: ~~(target * maxMultiplier),
  };
}
function inputValidation(inputs,logger) {
  try {
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
		if (inputs.audio_unknown_tag_lang === '') {
      logger.AddError(`audio_unknown_tag_lang options not set, please configure all options.`);
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
function streamByType(type, file, logger, method) {
  let id = 0;
  for (let i = 0; i < file.ffProbeData.streams.length; i++) {
    try {
      if (file.ffProbeData.streams[i].codec_type.toLowerCase() === type) {
        method(file.ffProbeData.streams[i], id);
        id++
      }
    } catch (err) {
      logger.AddError(`Hit error looking for ${type} in ${i}. Error: ${err}`)
    }
  }
}
function removeFromArray(array, stream) {
	const index = array.indexOf(array[stream]);
	array.splice(index, 1);
}
function checkArraySize(array){
  if (array.length >= 1){
    return true;
  } else {
    return false
  }
}
function audioUknownFilter(inputs,array,file,und2chan,und6chan,und8chan,logger,configuration){
  const language = inputs.audio_language.split(',');
  let suitableTrackFound = false;
	function tagTitle(stream,title,logger){
		configuration.AddOutputSetting(`-metadata:s:a:${stream} title="${title}"`);
		logger.AddWarning(`Audio at stream ${stream} found with no title. Adding title ${title}.`);
  }
  function checkTagLanguage(file,inputs,stream,logger){
    if (typeof file.ffProbeData.streams[stream].tags.language === 'undefined' || file.ffProbeData.streams[stream].tags.language !== "und"){
      configuration.AddOutputSetting(`-metadata:s:a:${stream} language=${inputs.audio_unknown_tag_lang}`);
      logger.AddWarning(`Audio at stream ${stream} found with no language. Adding language ${inputs.audio_unknown_tag_lang}.`);
    }
  }
  if (array.length >= 2){
    for (stream in array) {
      try {
        if (language.indexOf(file.ffProbeData.streams[array[stream]].tags.language.toLowerCase(),) === 1 && suitableTrackFound === false){
          suitableTrackFound = true;
        }
      } catch (err) {

      }
    }
  } 

  if (suitableTrackFound === true){
    //We have a track with the correct language tag. Assuming its not commetnary cause there is no title. Will remove in language filter.
  } else {
	  for (stream in array) {
	  	try {
	  		if (typeof file.ffProbeData.streams[array[stream]].tags.title === "undefined" || file.ffProbeData.streams[array[stream]].tags.title === 'und'){
	  			if (file.ffProbeData.streams[array[stream]].channels === 8){
            tagTitle(array[stream],"7.1",logger);
            checkTagLanguage(file,inputs,array[stream],logger);
            if (checkArraySize === false){
              removeFromArray(array, stream);
              und8chan.push(stream);
            } else {
            }
	  			} else if (file.ffProbeData.streams[array[stream]].channels === 6) {
            tagTitle(array[stream],"5.1",logger);
            checkTagLanguage(file,inputs,array[stream],logger);
            if (checkArraySize === false){
              removeFromArray(array, stream);
              und6chan.push(stream);
            } else {
            }
	  			} else if (file.ffProbeData.streams[array[stream]].channels === 2) {
            tagTitle(array[stream],"2.0",logger);
            checkTagLanguage(file,inputs,array[stream],logger);
            if (checkArraySize === false){
              removeFromArray(array, stream);
              und2chan.push(stream);
            } else {
            }
	  			}
	  		}
	  	} catch (err) {
	  		logger.AddError(`Audio unknown loop hit an error on stream ${array[stream]}. Error: ${err}`);
	  	}
    }
  }
}
function audioCommentaryFilter(inputs,array,file,logger,configuration){
  if (inputs.audio_keep_commentary === "false") {
    for (stream in array) {
      try {
				if(array.length <= 1){
					//We are going to bail here, since we can not do any stream removal with one audio stream 
					logger.AddWarning(`Only have single audio stream. Will not attempt any removal.`)
					return true;
				} else if (typeof file.ffProbeData.streams[array[stream]].tags.title === undefined){
					logger.AddWarning(`Stream at ${array[stream]} has no title, cannot proccess this.`)
				} else {
					if (file.ffProbeData.streams[array[stream]].tags.title.toLowerCase().includes('commentary')){
						logger.AddWarning(`Removing undesired commentary audio at stream: ${array[stream]}`);
						configuration.AddOutputSetting(`-map -0:a:${array[stream]}`);
						removeFromArray(array, stream);
					} else if (file.ffProbeData.streams[array[stream]].tags.title.toLowerCase().includes('description')){
						logger.AddWarning(`Removing undesired description audio at stream: ${array[stream]}`);
						configuration.AddOutputSetting(`-map -0:sa:${array[stream]}`);
						removeFromArray(array, stream);
					}
				}
      } catch (err) {
        logger.AddError(`Audio commentary loop hit an error on stream ${array[stream]}. Error: ${err}`)
      }
    }
  } else {
    logger.AddSuccess(`Removing of commentary audio has been disabled.`)
  }
}
function audioLanguageFilter(inputs,array,file,logger,configuration){
  const language = inputs.audio_language.split(',');
  for (stream in array) {
		if(array.length <= 1){
			//We are going to bail here, since we can not do any stream removal with one audio stream 
			logger.AddWarning(`Only have single audio stream. Will not attempt any removal.`)
			return true;
		} else if (typeof file.ffProbeData.streams[array[stream]].tags.title === undefined){
      logger.AddWarning(`Stream at ${array[stream]} has no title, removing.`)
      configuration.AddOutputSetting(`-map -0:a:${array[stream]}`);
      removeFromArray(array, stream);
		} else {
    	try {
    	  if (language.indexOf(file.ffProbeData.streams[array[stream]].tags.language.toLowerCase(),) === -1 ) {
    	    logger.AddWarning(`Removing audio with language ${file.ffProbeData.streams[array[stream]].tags.language}`)
					configuration.AddOutputSetting(`-map -0:a:${array[stream]}`);
					removeFromArray(array, stream);
    	  }
    	} catch (err) {
    	  logger.AddError(`Audio Language loop hit an error on stream ${array[stream]}. Error: ${err}`);
			}
		}
	}
}
function audioCodecFilter(array,file,und2chan,und6chan,und8chan,logger,configuration) {
  function checkForCodec(array,stream,file,logger){
    if (file.ffProbeData.streams[stream].codec_name.search(/aac|ac3|eac3/i) === -1){
      return 0;
    } else {
      logger.AddSuccess(`Stream has acceptable codec. Stream number: ${stream} Codec: ${file.ffProbeData.streams[stream].codec_name}`);
      removeFromArray(array, stream);
    }
  }
  function convAndTag(array,stream,file,logger,configuration){
    if (file.ffProbeData.streams[stream].codec_name.search(/aac|ac3|eac3/i) === -1){
      logger.AddWarning(`Stream does not have acceptable codec. Codec is ${file.ffProbeData.streams[stream].codec_name}.`)
      let channelCount = file.ffProbeData.streams[stream].channels;
      let title;
      if (typeof file.ffProbeData.streams[stream].title === 'undefined' || file.ffProbeData.streams[stream].title.toLowerCase() === '') {
        if (file.ffProbeData.streams[stream].channels === 8){
          title = "7.1";
        } else if (file.ffProbeData.streams[stream].channels === 6){
          title = "5.1";
        } else if (file.ffProbeData.streams[stream].channels === 2){
          title = "2.0";
        }
      } else {
        title = file.ffProbeData.streams[stream].title;
      }
      logger.AddWarning(`Copying stream ${stream}. Channel count: ${channelCount} Target Codec: EAC3`)
      configuration.AddOutputSetting(`-map 0:${stream} -c:a:0 eac3 -ac ${channelCount} -metadata:s:a:0 title="${title}"`);
      removeFromArray(array, stream);
      return 1;
    }
    return 0
  }
  if (array.length === 1){
    //not much we can do here, just check codec and convert if needed. We cannot prioritize channel count with a single stream.
    try {
      checkForCodec(array,array[stream],file,logger);
      if (array.length === 1){
        //Track is still in the array, we need to copy and convert it
        convAndTag(array,array[stream],file,logger,configuration)
        if (array.length === 1){
          //Just double check out array is now empty, the track should have been removed for conversion.
          log.AddError(`Audio track array is not empty, this shouldn't happen.`)
        }
      }
    } catch (err) {

    }
    return;
  } else {
    //Codec Checks. (Codec check will remove out of array if the track will work)
    if (und2chan.length >= 0){
      for (stream in und2chan) {
        try{
          checkForCodec(und2chan,stream,file,logger);
        } catch (err){

        }
      }
    }
    if (und6chan.length >= 0){
      for (stream in und6chan){
        try{
          checkForCodec(und6chan,stream,file,logger);
        } catch (err){

        }
      }
    } 
    if (und8chan.length >= 0){
      for (stream in und8chan){
        try{
          checkForCodec(und8chan,stream,file,logger);
        } catch (err){

        }
      }
    }
    //Codec Conversion (If we still have trakcs in array, we need to convert one. We will prefer High channel count to low.)
    if (und8chan.length >= 0){
      for (stream in und8chan) {
        try{
          if (convAndTag(und8chan,stream,file,logger,configuration) === 1){
            return;
          }
        } catch (err){

        }
      }
    }
    if (und6chan.length >= 0){
      for (stream in und6chan){
        try{
          if (convAndTag(und6chan,stream,file,logger,configuration) === 1){
            return;
          }
        } catch (err){

        }
      }
    } 
    if (und2chan.length >= 0){
      for (stream in und2chan){
        try{
          if (convAndTag(und2chan,stream,file,logger,configuration) === 1){
            return;
          }
        } catch (err){

        }
      }
    }
  }

}
function runAudioFilters(inputs,array,file,logger){
  let configuration = new Configurator(["-c:a copy"]);
  //Arrays to hold our Undefined streams. These can be problematic but need to be used in specific scenarios. We still need to check audio codecs for them though.
  let undefined2ChannelStreams = [];
  let undefined6ChannelStreams = [];
  let undefined8ChannelStreams = [];
  audioUknownFilter(inputs,array,file,undefined2ChannelStreams,undefined6ChannelStreams,undefined8ChannelStreams,logger,configuration);
  if (checkArraySize === false){
    audioCommentaryFilter(inputs,array,file,logger,configuration);
  }
  if (checkArraySize === false){
    audioLanguageFilter(inputs,array,file,logger,configuration);
  }
  audioCodecFilter(array,file,undefined2ChannelStreams,undefined6ChannelStreams,undefined8ChannelStreams,logger,configuration);
	return configuration;
}
function buildSubtitleConfiguration(inputs, file, logger) {
  var configuration = new Configurator(["-c:s copy"]);

  if (!inputs.subtitle_language) return configuration;
  var languages = inputs.subtitle_language.split(",");

  streamByType("subtitle", file, logger, function(stream, id) {
    if (stream.codec_name === "eia_608") {
      // unsupported subtitle codec?
      configuration.AddOutputSetting(`-map -0:s:${id}`);
      return;
    }

    if ("tags" in stream) {
      // Remove unwated languages
      if ("language" in stream.tags) {
        if (languages.indexOf(stream.tags.language.toLowerCase()) === -1) {
          configuration.AddOutputSetting(`-map -0:s:${id}`);
          logger.AddError(
            `Removing subtitle in language ${stream.tags.language}`
          );
        }
      }

      // Remove commentary subtitles
      if ("title" in stream.tags) {
        if (
          stream.tags.title.toLowerCase().includes("commentary") ||
          stream.tags.title.toLowerCase().includes("description") ||
          stream.tags.title.toLowerCase().includes("sdh")
        ) {
          configuration.AddOutputSetting(`-map -0:s:${id}`);
          logger.AddError(
            `Removing Commentary or Description subtitle: ${stream.tags.title}`
          );
        }
      }
    }
  });

  if (!configuration.shouldProcess) {
    logger.AddSuccess("No subtitle processing necessary");
  }

  return configuration;
}
function buildVideoConfiguration(inputs, file, logger){
  var configuration = new Configurator(["-map 0", "-map -0:d", "-c:v copy"]);

  streamByType("video", file, logger, function(stream, id) {
    if (stream.codec_name === "mjpeg"){
      configuration.AddOutputSetting(`-map -v:${id}`)
      return;
    }

    if (stream.codec_name === "hevc" && file.container === inputs.container) {
      logger.AddSuccess("File is in HEVC codec and in MKV");
      return;
    }

    // Check if should Remux.
    if (stream.codec_name === "hevc" && file.container !== inputs.container) {
      configuration.AddOutputSetting("-c:v copy");
      logger.AddError("File is in HEVC codec but not MKV. Will remux");
    }

    if (stream.codec_name !== "hevc") {
      var bitrate = calculateBitrate(file);

      var bitrateSettings = `-b:v ${bitrate.target}k -minrate ${bitrate.min}k -maxrate ${bitrate.max}k -bufsize ${bitrate.original}k`;

      //Output settings for NVENC
      configuration.RemoveOutputSetting("-c:v copy");
      configuration.AddOutputSetting(`-c:v hevc_nvenc -rc:v vbr_hq -cq:v 19 ${bitrateSettings} -spatial_aq:v 1 -rc-lookahead:v 32`);

      if (file.video_codec_name === "h263") {
        configuration.AddInputSetting("-c:v h263_cuvid");
      } else if (file.video_codec_name === "h264") {
        if (file.ffProbeData.streams[id].profile === 'High 10' 
            || file.ffProbeData.streams[id].bits_per_raw_sample === '10'){
          configuration.AddInputSetting('-c:v h264_cuvid -pix_fmt p010le');
          logger.AddWarning(`Source is 10Bit, we are adding extra flags to keep 10Bit.`)
        }
      } else if (file.video_codec_name === "mjpeg") {
        configuration.AddInputSetting("-c:v mjpeg_cuvid");
      } else if (file.video_codec_name == "mpeg1") {
        configuration.AddInputSetting("-c:v mpeg1_cuvid");
      } else if (file.video_codec_name == "mpeg2") {
        configuration.AddInputSetting("-c:v mpeg2_cuvid");
      } else if (file.video_codec_name == "vc1") {
        configuration.AddInputSetting("-c:v vc1_cuvid");
      } else if (file.video_codec_name == "vp8") {
        configuration.AddInputSetting("-c:v vp8_cuvid");
      } else if (file.video_codec_name == "vp9") {
        configuration.AddInputSetting("-c:v vp9_cuvid");
      }

      logger.AddWarning("Transcoding to HEVC using NVidia NVENC");
      logger.AddWarning(`Encoder configuration:\n• Original Bitrate: ${bitrate.original}\n• Target Bitrate: ${bitrate.target}\n• Minimum Bitrate: ${bitrate.min}\n• Maximum Bitrate: ${bitrate.max}`);
    }

  });

  if (!configuration.shouldProcess) {
    logger.AddSuccess("No video processing necessary");
  }
  return configuration;
}
function buildAudioConfiguration(_inputs, file, logger, id) {
  var configuration = new Configurator(["-c:a copy"]);
  let audioStreamCount = file.ffProbeData.streams.filter((row) => row.codec_type.toLowerCase() == "audio").length;
  let foundID = null;
  streamByType("audio", file, logger, function(stream, id) {
    if (stream.tags.language.search(/eng|und/i) !== -1){
      if (stream.codec_name.search(/aac|ac3|eac3/i) !== -1 && stream.channels === 2){
        logger.AddSuccess(`We already have an 2 channel stream in ${stream.codec_name}.`);
        foundID = id;
      } else if (stream.codec_name.search(/aac|ac3|eac3/i) !== -1 && stream.channels === 6){
        logger.AddSuccess(`We already have an 6 channel stream in ${stream.codec_name}.`);
        foundID = id;
      } else if (stream.codec_name.search(/aac|ac3|eac3/i) !== -1 && stream.channels === 8){
        logger.AddSuccess(`We already have an 8 channel stream in ${stream.codec_name}.`);
        foundID = id;
      } else {
        logger.AddWarning(`We didnt find an audio stream in the correct codec. Codec is ${stream.codec_name} Channel Count: ${stream.channels}`)
      }
    } else {
      logger.AddWarning(`Found audio language not in English or undefined.`)
      if (audioStreamCount <= 1){
        logger.AddWarning(`Will not remove audio track as it is the only one.`)
      } else {
        logger.AddWarning(`Removing audio track in language ${stream.tags.language}`)
        configuration.AddOutputSetting(`-map -0:a:${id}`);
      }
    }
  });
  var hasNonAc3MultiChannelAudio = false;
  var hasMultiChannelAudio = false;
  var nonMultiChannelCount = null;
  if (foundID === null){
    streamByType("audio", file, logger, function(stream, id) {
      hasMultiChannelAudio = stream.channels >= 6;
      if (stream.codec_name.search(/aac|ac3|eac3/i) === -1 && stream.channels === 8){
        configuration.AddOutputSetting(`-map 0:${id} -c:a:0 eac3 -ac 8 -metadata:s:a:0 title="7.1"`);
        hasNonAc3MultiChannelAudio = true;
        nonMultiChannelCount = 8;
        return;
      } else if (stream.codec_name.search(/aac|ac3|eac3/i) === -1 && stream.channels === 6){
        configuration.AddOutputSetting(`-map 0:${id} -c:a:0 eac3 -ac 6 -metadata:s:a:0 title="5.1"`);
        hasNonAc3MultiChannelAudio = true;
        nonMultiChannelCount = 6;
        return;
      } else if (stream.codec_name.search(/aac|ac3|eac3/i) === -1 && stream.channels === 2){
        configuration.AddOutputSetting(`-map 0:${id} -c:a:0 eac3 -ac 2 -metadata:s:a:0 title="2.0"`);
        hasNonAc3MultiChannelAudio = true;
        nonMultiChannelCount = 6;
        return;
      }

      if ("tags" in stream && "title" in stream.tags) {
        if (
          stream.tags.title.toLowerCase().includes("commentary") ||
          stream.tags.title.toLowerCase().includes("description") ||
          stream.tags.title.toLowerCase().includes("sdh")
        ) {
          configuration.AddOutputSetting(`-map -0:a:${id}`);
          logger.AddError(
            `Removing Commentary or Description audio track: ${stream.tags.title}`
          );
        }
      }
    });
    if (hasNonAc3MultiChannelAudio) {
      logger.AddError(`Will copy ${nonMultiChannelCount} channel audio to EAC3`);
    }
  
    if (!hasMultiChannelAudio) {
      logger.AddError("No multi channel audio found");
    }
  
    if (!configuration.shouldProcess) {
      logger.AddSuccess("No audio processing necessary");
    }
  }

  return configuration;
}
function plugin(file, _librarySettings, inputs) {
  //Response variable
  var response = {
    processFile: false,
    preset: '',
    container: `.${inputs.container}`,
    handBrakeMode: false,
    FFmpegMode: true,
    reQueueAfter: false,
    infoLog: '',
  };

  //Stream Indecies
  let audioStreams = [];

  //Variables
  var logger = new Log();

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

  //streamByTypeToArray("audio", audioStreams, file)
  let subtitleConfiguration = buildSubtitleConfiguration(inputs, file, logger);
  let audioConfiguration = buildAudioConfiguration(inputs, file, logger);
  let videoConfiguration = buildVideoConfiguration(inputs, file, logger)

  //Can enable to output ffmpeg configuration for debugging.
  //logger.AddWarning(`${videoConfiguration.GetInputSettings()},${videoConfiguration.GetOutputSettings()} ${subtitleConfiguration.GetOutputSettings()} ${audioConfiguration.GetOutputSettings()} -max_muxing_queue_size 4096`)

  response.preset = `${videoConfiguration.GetInputSettings()},${videoConfiguration.GetOutputSettings()} ${subtitleConfiguration.GetOutputSettings()} ${audioConfiguration.GetOutputSettings()} -max_muxing_queue_size 4096`;
  response.processFile = audioConfiguration.shouldProcess || videoConfiguration.shouldProcess || subtitleConfiguration.shouldProcess;

  if (!response.processFile) {
    logger.AddSuccess("No need to process file");
  }

  response.infoLog += logger.GetLogData();
  return response;
}
module.exports.details = details;
module.exports.plugin = plugin;
