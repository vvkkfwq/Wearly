export function pickGarmentPhoto(onPhoto: (photo: Blob) => void) {
  uni.chooseImage({
    count: 1,
    sourceType: ['camera', 'album'],
    success: ({ tempFiles }) => {
      const file = Array.isArray(tempFiles) ? tempFiles[0] : tempFiles
      if (file instanceof Blob) onPhoto(file)
    },
  })
}
