$srcBin = "D:\Downloads\cudnn-windows-x86_64-9.23.1.3_cuda12-archive\cudnn-windows-x86_64-9.23.1.3_cuda12-archive\bin\x64\*"
$srcInc = "D:\Downloads\cudnn-windows-x86_64-9.23.1.3_cuda12-archive\cudnn-windows-x86_64-9.23.1.3_cuda12-archive\include\x64\*"
$srcLib = "D:\Downloads\cudnn-windows-x86_64-9.23.1.3_cuda12-archive\cudnn-windows-x86_64-9.23.1.3_cuda12-archive\lib\x64\*"

$dstBin = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\bin"
$dstInc = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\include"
$dstLib = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\lib\x64"

Copy-Item -Path $srcBin -Destination $dstBin -Force
Copy-Item -Path $srcInc -Destination $dstInc -Force
Copy-Item -Path $srcLib -Destination $dstLib -Force
