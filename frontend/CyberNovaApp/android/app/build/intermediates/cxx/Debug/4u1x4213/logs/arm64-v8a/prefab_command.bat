@echo off
"C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.18.8-hotspot\\bin\\java" ^
  --class-path ^
  "C:\\Users\\mtec22-002\\.gradle\\caches\\modules-2\\files-2.1\\com.google.prefab\\cli\\2.1.0\\aa32fec809c44fa531f01dcfb739b5b3304d3050\\cli-2.1.0-all.jar" ^
  com.google.prefab.cli.AppKt ^
  --build-system ^
  cmake ^
  --platform ^
  android ^
  --abi ^
  arm64-v8a ^
  --os-version ^
  24 ^
  --stl ^
  c++_shared ^
  --ndk-version ^
  27 ^
  --output ^
  "C:\\Users\\MTEC22~1\\AppData\\Local\\Temp\\agp-prefab-staging6139105999182427408\\staged-cli-output" ^
  "C:\\Users\\mtec22-002\\.gradle\\caches\\9.0.0\\transforms\\df62f4a3c6818dc3cc09553936c6f2fd\\transformed\\react-android-0.84.1-debug\\prefab" ^
  "C:\\Users\\mtec22-002\\.gradle\\caches\\9.0.0\\transforms\\9d34929fdb65a145dc091d62c15d0d86\\transformed\\hermes-android-250829098.0.9-debug\\prefab" ^
  "C:\\Users\\mtec22-002\\.gradle\\caches\\9.0.0\\transforms\\6cb94eb4240b26bae55579cb79d8f81a\\transformed\\fbjni-0.7.0\\prefab"
