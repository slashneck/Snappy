# Third party notices

Snappy itself is released under the GNU General Public License version 3 (see `LICENSE`). It ships with or is built on
the following projects.

## FFmpeg

Snappy runs `ffmpeg.exe` as a separate program for screen capture, encoding and editing. The included binary is the
FFmpeg 9.0.1 "essentials" build made by gyan.dev, licensed under the GNU General Public License version 3.

- License text: `ffmpeg/LICENSE` next to Snappy, or https://www.gnu.org/licenses/gpl-3.0.html
- FFmpeg source code: https://ffmpeg.org/download.html
- Build details: https://www.gyan.dev/ffmpeg/builds/

FFmpeg is not modified by Snappy.

## Microsoft Edge WebView2 SDK

Snappy's window uses the WebView2 SDK (`Microsoft.Web.WebView2`), redistributed under this license:

```
Copyright (C) Microsoft Corporation. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

   * Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.
   * Redistributions in binary form must reproduce the above
copyright notice, this list of conditions and the following disclaimer
in the documentation and/or other materials provided with the
distribution.
   * The name of Microsoft Corporation, or the names of its contributors
may not be used to endorse or promote products derived from this
software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

The WebView2 Runtime itself is part of Windows and is not included.

## .NET

Snappy is built with .NET and includes the .NET runtime.
Copyright (c) .NET Foundation and Contributors, MIT license.

- Source and license: https://github.com/dotnet/runtime
- Notices for the runtime's own dependencies: https://github.com/dotnet/runtime/blob/main/THIRD-PARTY-NOTICES.TXT
