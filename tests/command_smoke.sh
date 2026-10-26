#!/usr/bin/env bash
set -euo pipefail

smoke_dir="$(mktemp -d "${TMPDIR:-/tmp}/osint-tt-smoke.XXXXXX")"
cleanup() { rm -rf "$smoke_dir"; }
trap cleanup EXIT

printf '%s' 'SGVsbG8=' > "$smoke_dir/base64.txt"
python3 -c 'import base64;assert base64.b64decode("SGVsbG8=",validate=True)==b"Hello"'
python3 -c 'import base64;assert base64.b32decode("JBSWY3DP")==b"Hello"'
python3 -c 'import base64;assert base64.b85decode("NM&qnZy")==b"Hello"'
python3 -c 'import gzip,pathlib;pathlib.Path("'"$smoke_dir"'/decoded.bin").write_bytes(gzip.compress(b"bounded output"))'
python3 -c 'import gzip;f=gzip.open("'"$smoke_dir"'/decoded.bin","rb");d=f.read(10000001);f.close();assert len(d)<=10000000;open("'"$smoke_dir"'/out.bin","wb").write(d)'
file "$smoke_dir/out.bin" | rg -q 'text|ASCII'

printf '%s' 'correct horse battery staple' > "$smoke_dir/password.txt"
printf '%s' 'verified plaintext' > "$smoke_dir/plain.txt"
openssl enc -aes-256-cbc -pbkdf2 -in "$smoke_dir/plain.txt" -out "$smoke_dir/cipher.bin" -pass "file:$smoke_dir/password.txt"
openssl enc -d -aes-256-cbc -pbkdf2 -in "$smoke_dir/cipher.bin" -out "$smoke_dir/recovered.txt" -pass "file:$smoke_dir/password.txt"
cmp "$smoke_dir/plain.txt" "$smoke_dir/recovered.txt"

sqlite3 "$smoke_dir/History" 'CREATE TABLE urls(url TEXT,title TEXT,last_visit_time INTEGER); INSERT INTO urls VALUES("https://example.org/","Synthetic",123);'
sqlite3 -readonly "$smoke_dir/History" '.tables' | rg -q 'urls'
sqlite3 -readonly "$smoke_dir/History" 'SELECT url FROM urls;' | rg -q 'https://example.org/'

font_path='/System/Library/Fonts/Supplemental/Tahoma.ttf'
if [[ ! -f "$font_path" ]]; then font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'; fi
magick -size 700x260 xc:white -fill black -font "$font_path" -pointsize 52 -gravity center -annotate 0 'SYNTHETIC CLUE 42' "$smoke_dir/ocr.png"
exiftool -overwrite_original -GPSLatitude=13.7563 -GPSLongitude=100.5018 "$smoke_dir/ocr.png" >/dev/null
exiftool -n -GPSLatitude -GPSLongitude "$smoke_dir/ocr.png" | rg -q '13.7563|100.5018'
tesseract "$smoke_dir/ocr.png" stdout --psm 6 2>/dev/null | rg -qi 'SYNTHETIC|CLUE'

magick -size 640x480 xc:navy "$smoke_dir/photo.jpg"
magick -size 120x80 xc:cyan "$smoke_dir/thumb.jpg"
exiftool -overwrite_original -Make=Synthetic -Model=CTF-Cam -Software=LocalTool -XMP-dc:Creator=Synthetic -IPTC:Keywords=ctf "-ThumbnailImage<=$smoke_dir/thumb.jpg" "$smoke_dir/photo.jpg" >/dev/null
exiftool -Make -Model -LensMake -LensModel -SerialNumber "$smoke_dir/photo.jpg" | rg -q 'Synthetic|CTF-Cam'
exiftool -a -G1 -s -Software -CreatorTool -ProcessingSoftware -HistorySoftwareAgent "$smoke_dir/photo.jpg" | rg -q 'LocalTool'
exiftool -b -ThumbnailImage "$smoke_dir/photo.jpg" > "$smoke_dir/extracted.jpg"
file "$smoke_dir/extracted.jpg" | rg -q 'JPEG image'
exiftool -a -G0:1 -s -DateTimeOriginal -CreateDate -ModifyDate -FileModifyDate -OffsetTimeOriginal -GPSDateTime "$smoke_dir/photo.jpg" >/dev/null
exiftool -a -G1 -s -xmp:all -iptc:all "$smoke_dir/photo.jpg" | rg -q 'Synthetic|ctf'
mkdir "$smoke_dir/images"
cp "$smoke_dir/photo.jpg" "$smoke_dir/images/"
exiftool -r -a -G1 -s -csv -ext jpg -ext jpeg -ext png "$smoke_dir/images" > "$smoke_dir/metadata.csv"
rg -q 'SourceFile' "$smoke_dir/metadata.csv"

printf '%s\n' '0000  12 34 01 00 00 01 00 00 00 00 00 00 07 65 78 61' '0010  6d 70 6c 65 03 6f 72 67 00 00 01 00 01' > "$smoke_dir/dns.hex"
text2pcap -q -4 192.0.2.1,198.51.100.2 -u 12345,53 "$smoke_dir/dns.hex" "$smoke_dir/dns.pcapng"
tshark -r "$smoke_dir/dns.pcapng" -Y dns -T fields -e dns.qry.name | rg -q 'example.org'
mkdir "$smoke_dir/zeek"
(cd "$smoke_dir/zeek" && zeek -r ../dns.pcapng LogAscii::use_json=T)
test -s "$smoke_dir/zeek/conn.log"

ffmpeg -hide_banner -loglevel error -f lavfi -i color=c=navy:s=320x240:d=1 -f lavfi -i sine=frequency=440:duration=1 -shortest -c:v libx264 -pix_fmt yuv420p -c:a aac "$smoke_dir/sample.mp4"
ffprobe -v error -show_format -show_streams -of json "$smoke_dir/sample.mp4" | jq -e '.streams|length>=2' >/dev/null
ffmpeg -hide_banner -loglevel error -ss 00:00:00.2 -i "$smoke_dir/sample.mp4" -frames:v 1 "$smoke_dir/frame.png"
file "$smoke_dir/frame.png" | rg -q 'PNG image'

vol -h | rg -q 'windows.pslist'
mmls -V | rg -q 'Sleuth Kit'
hashcat --version | rg -q '^v?[0-9]'
binwalk --help >/dev/null

printf '%s\n' 'PASS synthetic commands: strict decoders, bounded gzip, OpenSSL, SQLite, extended ExifTool/OCR, PCAP/TShark/Zeek, FFmpeg, Volatility, Sleuth Kit, Hashcat, Binwalk'
