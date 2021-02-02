/* eslint-disable */
function details() {
  return {
    id: "Tdarr_Plugin_Noms_AIO_MediaCleanup",
    Name: "Noms AIO Media Cleanup [NVENC]",
    Stage: "Pre-processing",
    Type: "Video",
    Operation: "Transcode",
    Description:
      "[Single Pass] Single pass script aimed to do a single transcode proccess to save time. This merges every other plugin from Noms under one roof.",
    Version: "1.0",
    Tags: "pre-processing, ffmpeg, subtitle, audio, video, nvenc h265",
    Inputs: [
      {
        name: "nvenc",
        tooltip:
          "If the NVidia NVENC encoder should be used. Requires an NVidia GPU with NVENC capabilties.\\nValid values: true / false\\nDefault: false",
      },
      {
        name: "qsv",
        tooltip:
          "If Intel Quick Sync should be used. Requires an Intel CPU with Quick Sync capabilties.\\nValid values: true / false\\nDefault: false",
      },
      {
        name: "minimum_target_bitrate",
        tooltip:
          "The minimum RESULTING bitrate allowed for a file. Any target bitrate lower than this will cause transcoding to be skipped.\\nExample value: 3000",
      },
      {
        name: "wanted_subtitle_languages",
        tooltip:
          "The comma separated subtitle languages (in 3 letter format) you'd like to keep. If left blank, all subtitles will be kept.\\nExample value: eng,fre",
      },
    ],
  };
}