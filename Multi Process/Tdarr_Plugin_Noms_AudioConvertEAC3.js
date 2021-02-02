/* eslint-disable */
function details() {
  return {
    id: 'Tdarr_Plugin_Noms_AudioConvertEAC3',
    Stage: 'Pre-processing',
    Name: 'Noms Convert Audio Tracks to EAC3',
    Type: 'Video',
    Operation: 'Remux',
    Description: `Converts audio tracks to EAC3 and will downmix if required. Will also set Default audio stream.\n\n`,
    Version: '1.0',
    Link: '',
    Tags: 'pre-processing,ffmpeg,audio only,',
    Inputs: [],
  };
}

function plugin(file, librarySettings, inputs) {
  const response = {
    processFile: false,
    container: `.${file.container}`,
    handBrakeMode: false,
    FFmpegMode: true,
    reQueueAfter: true,
    infoLog: '',
  };

  if (file.fileMedium !== 'video') {
    console.log('File is not video');
    response.infoLog += '☒File is not video \n';
    response.processFile = false;
    return response;
  } 

///////////////////// Variables /////////////////////

  //Generic Vars
  let ffmpegCommandInsert = "";
  let convert = false;
  
  //Audio search Vars
  let has2channel = false;
  let tracks2Channel = [];
  let has6channel = false;
  let tracks6Channel = [];
  let has8channel = false;
  let tracks8Channel = [];

  //Downmix Vars
  let downMixTrackSource = -1;
  let downMixQueued = 0;

///////////////////// Functions /////////////////////

  function dumpChannelInfo(numberofchannels, haschannel, trackarray) {
    response.infoLog += `${numberofchannels} Channel: `;
  if (haschannel === true) {
    response.infoLog += `true `;
    response.infoLog += `Track Numbers: `
    for (track in trackarray) {
      response.infoLog += `${trackarray[track]} `
    }
    response.infoLog += ` \n`;
  } else {
    response.infoLog += `false \n`;
  }
  }

  function scanChannelResults(channelcount, trackarray) {
    for (track in trackarray) {
      if (typeof file.ffProbeData.streams[trackarray[track]].tags.title === 'undefined' || file.ffProbeData.streams[trackarray[track]].tags.title === 'und') {
          if (file.ffProbeData.streams[trackarray[track]].codec_name.toLowerCase().includes('ac3')){
            response.infoLog += `Track ${trackarray[track]} for ${channelcount} Channel is ${file.ffProbeData.streams[trackarray[track]].codec_name.toLowerCase()}, `
            response.infoLog += `codec is acceptable. \n`
            ffmpegCommandInsert += `-disposition:${trackarray[track]} default `;
            return 1;
          } else if (file.ffProbeData.streams[trackarray[track]].codec_name.toLowerCase() === ('aac')){
            response.infoLog += `Track ${trackarray[track]} for ${channelcount} Channel is ${file.ffProbeData.streams[trackarray[track]].codec_name.toLowerCase()}, `
            response.infoLog += `codec is acceptable. \n`
            ffmpegCommandInsert += `-disposition:${trackarray[track]} default `;
            return 1;
          } else {
            response.infoLog += `Track ${trackarray[track]} for ${channelcount} Channel is ${file.ffProbeData.streams[trackarray[track]].codec_name.toLowerCase()}, `
            response.infoLog += `codec is NOT acceptable. Continuing. \n`
          }
        } else {
          if (file.ffProbeData.streams[trackarray[track]].tags.title.toLowerCase().includes('commentary') || file.ffProbeData.streams[trackarray[track]].tags.title.toLowerCase().includes('description')) {
            response.infoLog += `Track ${trackarray[track]} for ${channelcount} Channel is Commentary, skipping this. \n`
          } else if (file.ffProbeData.streams[trackarray[track]].codec_name.toLowerCase().includes('ac3')){
            response.infoLog += `Track ${trackarray[track]} for ${channelcount} Channel is ${file.ffProbeData.streams[trackarray[track]].codec_name.toLowerCase()}, `
            response.infoLog += `codec is acceptable. \n`
            ffmpegCommandInsert += `-disposition:${trackarray[track]} default `;
            return 1;
          } else if (file.ffProbeData.streams[trackarray[track]].codec_name.toLowerCase() === ('aac')){
            response.infoLog += `Track ${trackarray[track]} for ${channelcount} Channel is ${file.ffProbeData.streams[trackarray[track]].codec_name.toLowerCase()}, `
            response.infoLog += `codec is acceptable. \n`
            ffmpegCommandInsert += `-disposition:${trackarray[track]} default `;
            return 1;
          } else {
            response.infoLog += `Track ${trackarray[track]} for ${channelcount} Channel is ${file.ffProbeData.streams[trackarray[track]].codec_name.toLowerCase()}, `
            response.infoLog += `codec is NOT acceptable. Continuing. \n`
          }          
        }
    }
    //We should only hit this return if we run out of audio tracks
    response.infoLog += `Found no suitable audio track in ${channelcount} channel Group. \n`
    return 0;
  }

  function getDownmixCapableTrack(trackarray) {
    for (track in trackarray) {
      if (typeof file.ffProbeData.streams[trackarray[track]].tags.title === 'undefined' || file.ffProbeData.streams[trackarray[track]].tags.title === 'und') {
        downMixTrackSource = trackarray[track];
        return 1;      
      } else {
        if (file.ffProbeData.streams[trackarray[track]].tags.title.toLowerCase().includes('commentary') || file.ffProbeData.streams[trackarray[track]].tags.title.toLowerCase().includes('description')) {
          response.infoLog += `Track ${trackarray[track]} is Commentary, Marking this not for use.`
        } else {
          downMixTrackSource = trackarray[track];
          return 1;
        }
      }
    }
    return 0;
  }

  function createDownmix(sourcechannelcount, targetchannelcount, tracknumber) {
    let title;
    if (targetchannelcount === 8){
      title = "7.1";
    } else if (targetchannelcount === 6) {
      title = "5.1";
    } else if (targetchannelcount === 2) {
      title = "2.0";
    }
    ffmpegCommandInsert += `-map 0:${tracknumber} -c:a:0 eac3 -ac ${targetchannelcount} -metadata:s:a:0 title=${title} `
    downMixQueued = 1;
    convert = true;
    response.infoLog += `Conversion being added to queue. Converting ${sourcechannelcount} channel to ${targetchannelcount} channel in EAC3. \n`
    response.infoLog += `Original track will be kept, new stream will be made default. \n`
  }

  // Go through each stream in the file.
  for (let i = 0; i < file.ffProbeData.streams.length; i++) {
    try {
      // Go through all audio streams and check if 2,6 & 8 channel tracks exist or not.
      if (typeof file.ffProbeData.streams[i].channels !== 'undefined') {
        if (typeof file.ffProbeData.streams[i].tags.language !== 'undefined' 
            && file.ffProbeData.streams[i].codec_type.toLowerCase() === 'audio'
           ) 
        {
          if (file.ffProbeData.streams[i].channels === 2) 
          {
            has2channel = true;
            tracks2Channel.push(i);
          } else if (file.ffProbeData.streams[i].channels === 6) 
          {
            has6channel = true;
            tracks6Channel.push(i);
          } else if (file.ffProbeData.streams[i].channels === 8) 
          {
            has8channel = true;
            tracks8Channel.push(i);
          } else {
          }
        }
      } else {
        //response.infoLog += `⚠Audio track loop found non-audio track at stream ${i} \n`
      }
    } catch (err) {
      response.infoLog += `⚠Audio track loop hit error, trying to hit stream ${i}: ${err} \n`;
    }
  }

  //response.infoLog += `Dumping Audio channels and tracks \n`;
  //dumpChannelInfo(2, has2channel, tracks2Channel);
  //dumpChannelInfo(6, has6channel, tracks6Channel);
  //dumpChannelInfo(8, has8channel, tracks8Channel);
  //return response;

  if (has2channel === false && has6channel === false && has8channel === false) {
    response.infoLog += `⚠ We found no audio streams in this file, stopping plugin.`
    return response;
  }


  if (has8channel === true && scanChannelResults(8, tracks8Channel) === 1) {
    return response;
  } else if (has6channel === true && scanChannelResults(6, tracks6Channel) === 1) {
    return response;
  } else if (has2channel === true && scanChannelResults(2, tracks2Channel) === 1) {
    return response;
  } else {
    response.infoLog += `Run out of potential audio tracks. We will scan for highest channel group to convert. \n`;
  }

  if (has8channel === true && getDownmixCapableTrack(tracks8Channel) === 1 && downMixQueued === 0) {
    createDownmix(8, 8, downMixTrackSource)
  } else if (has6channel === true && getDownmixCapableTrack(tracks6Channel) === 1 && downMixQueued === 0) {
    createDownmix(6, 6, downMixTrackSource)
  } else if (has2channel === true && getDownmixCapableTrack(tracks2Channel) === 1 && downMixQueued === 0) {
    createDownmix(2, 2, downMixTrackSource)
  } else {
    response += `⚠We have no downmix capable tracks, ending plugin here. \n`
    return response;
  }

  //Clearing our array variables to prevent overflow
  tracks2Channel.length = 0;
  tracks6Channel.length = 0;
  tracks8Channel.length = 0;

// Convert file if convert variable is set to true.
if (convert === true) {
  response.processFile = true;
  response.preset = `, -map 0 -c:v copy -c:a copy ${ffmpegCommandInsert} `
  + '-strict -2 -c:s copy -max_muxing_queue_size 9999 ';
} else {
  response.infoLog += '⚠File contains all required audio formats. (You should not be hitting this reponse)⚠ \n';
  response.processFile = false;
}
return response;
}  
module.exports.details = details;
module.exports.plugin = plugin;
