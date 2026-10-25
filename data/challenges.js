(function () {
  'use strict';
  const C = (id, title, category, evidence, question, flow, tags, accent, tool, task) => ({
    id, title, category, evidence, question, flow, tags, accent,
    cover: `assets/covers/${id}.svg`, ...(tool ? { tool, task } : {})
  });
  window.OSINT_CHALLENGES = [
    C('unknown-first','Unknown Evidence','Start Here','Unknown file','“ฉันได้ไฟล์แปลก ๆ มา ควรเริ่มจากตรงไหน?”','00-MASTER-01-DECISION-ENGINE',['first steps','unknown','triage'],'#55d98b','file','identify'),
    C('image-geolocation','Image Geolocation','OSINT','Photo','“Where was this photograph taken?”','03-GEO-01-COUNTRY-REGION',['location','city','country','street'],'#53b7ff','exiftool','gps'),
    C('image-metadata','Image Metadata / EXIF','OSINT','Photo','“When was this picture taken?”','02-IMAGE-02-EXIF-GPS',['metadata','date taken','GPS','camera'],'#8b7dff','exiftool','timestamp'),
    C('landmark','Landmark Identification','OSINT','Photo','“Which building or landmark is visible?”','03-GEO-02-EXACT-PLACE',['building','landmark','shop','station'],'#ffb84d','tesseract','ocr'),
    C('coordinates','Map & Coordinates','OSINT','Map / coordinates','“Find the exact coordinates and verify the scene.”','03-GEO-05-MAP-SATELLITE',['latitude','longitude','map','satellite'],'#46d4b0','qgis','coordinates'),
    C('screenshot','Screenshot OSINT','OSINT','Screenshot','“Who posted this screenshot, and where is the original?”','02-IMAGE-04-SCREENSHOT-NO-METADATA',['screenshot','source','post','UI'],'#ff7b9c','imagemagick','crop'),
    C('ocr','OCR / Text in Images','OSINT','Image text','“What does the partially visible shop sign say?”','02-IMAGE-03-OCR',['OCR','sign','blurry text','logo'],'#f59e55','tesseract','ocr'),
    C('username','Username OSINT','OSINT','Username','“Which public account is genuinely associated with this alias?”','05-USERNAME-01-EXACT',['username','alias','profile','false positive'],'#b491ff','ripgrep','local-search'),
    C('social','Public Social Media','OSINT','Public post','“Find the original public post and publication time.”','05-USERNAME-03-PUBLIC-POST',['public post','author','platform','timestamp'],'#ff6f8d','curl','html'),
    C('domain','Domain Intelligence','OSINT','Domain / URL','“Which organization operates this domain?”','06-WEB-01-URL-DOMAIN-FIRST',['DNS','RDAP','WHOIS','organization'],'#4ac7f5','dig','records'),
    C('archive','Archived Websites','OSINT','Public webpage','“What did this page say before it changed?”','06-WEB-07-ARCHIVES',['archive','removed','former name','history'],'#e0a84c','diff','html'),
    C('document','Document Metadata','OSINT','PDF / Office','“Who created this document, and when?”','07-DOC-01-FIRST-TRIAGE',['PDF','DOCX','author','metadata'],'#7acb78','pdfinfo','metadata'),
    C('encoding','Encoded Text Recognition','OSINT + Crypto','String','“What information is hidden in this string?”','04-TEXT-01-IDENTIFY',['Base64','hex','JWT','nested encoding'],'#f3cb54','python','base64'),
    C('video','Video OSINT','OSINT','Video','“Which frame reveals the location and timestamp?”','08-MEDIA-01-VIDEO-FIRST',['video','frame','timestamp','OCR'],'#6d8eff','ffprobe','inspect'),
    C('audio','Audio OSINT','OSINT','Audio','“What public clue is heard in the background?”','08-MEDIA-04-AUDIO-FIRST',['audio','announcement','language','spectrogram'],'#e779ca','audacity','spectrogram'),
    C('history','Historical Event Research','OSINT','Date / event','“What happened here on this date?”','09-PUBLIC-03-TIMELINE',['history','event','date','timeline'],'#d39a68','python','timestamp'),
    C('organization','Public Organization Research','OSINT','Organization','“What is the official website and who operates it?”','09-PUBLIC-04-OFFICIAL-RECORDS',['official','organization','records','operator'],'#47c5a5','curl','html'),
    C('multi-question','Related CTF Questions','Pivoting','Multiple clues','“How do I reuse the last answer for the next question?”','10-PIVOT-05-MIXED-CHAINS',['pivot','follow-up','correlation','verify'],'#f09f50','ripgrep','local-search'),
    C('dns-intelligence','DNS Intelligence','OSINT','Domain / DNS','“Which public DNS records connect this domain to its infrastructure?”','06-WEB-02-DNS',['DNS','A AAAA MX NS TXT','PTR','delegation'],'#4cc9ed','dig','records'),
    C('google-dorking','Google Dorking','OSINT','Question only','“Which indexed public page contains this exact phrase?”','06-WEB-05-GOOGLE-DORKING',['Google dorking','site:','filetype:','exact phrase'],'#ffca58','ripgrep','local-search'),
    C('robots-sitemap','Robots & Sitemaps','OSINT','Domain / URL','“Which public URLs are listed but hard to find from navigation?”','06-WEB-06-ROBOTS-SITEMAP',['robots.txt','sitemap.xml','Disallow','lastmod'],'#6fcf9f','curl','robots'),
    C('reverse-image','Image Source Investigation','OSINT','Photo','“Can I find the original source without uploading the supplied image?”','02-IMAGE-05-SOURCE-NO-UPLOAD',['reverse image search','no upload','OCR pivot','local comparison'],'#ef8a73','imagemagick','compare'),
    C('crypto-master','Cryptography CTF','Cryptography','Cipher / key','“What encryption or encoding is hiding this message?”','13-CRYPTO-01-MASTER',['cipher','decrypt','key','plaintext'],'#a579ff','python','base64'),
    C('rsa','Weak RSA CTF','Cryptography','RSA parameters','“Given n, e and c, which weakness actually applies?”','13-CRYPTO-05-RSA',['RSA','n e c','factor','Wiener'],'#cf79ff','sympy','number-theory'),
    C('network-forensics','Network Forensics','Digital Forensics','PCAP / PCAPNG','“Which host downloaded the suspicious file?”','14-FORENSICS-03-NETWORK',['PCAP','DNS','HTTP POST','stream'],'#4cc9ed','tshark','triage'),
    C('disk-forensics','Disk Forensics','Digital Forensics','Disk image','“Recover the deleted file and explain its timeline.”','14-FORENSICS-04-DISK',['disk image','deleted file','filesystem','timeline'],'#73c783','sleuthkit','filesystem'),
    C('memory-forensics','Memory Forensics','Digital Forensics','Memory dump','“Which process made the suspicious connection?”','14-FORENSICS-05-MEMORY',['memory','process','PID','connection'],'#f07575','volatility3','processes'),
    C('windows-forensics','Windows Artifacts','Digital Forensics','EVTX / Registry','“Who ran this command, and when?”','14-FORENSICS-06-WINDOWS',['EVTX','registry','prefetch','PowerShell'],'#4aa6df','evtx','jsonl'),
    C('browser-forensics','Browser Forensics','Digital Forensics','SQLite database','“Which URL was visited before the download?”','14-FORENSICS-08-BROWSER',['browser','history','downloads','SQLite'],'#6fcf9f','sqlite3','browser'),
    C('media-forensics','Media Forensics','Digital Forensics','Image / audio / video','“Is there a real embedded clue or only a false positive?”','14-FORENSICS-10-IMAGE-MEDIA',['stego triage','QR','channels','spectrogram'],'#e8a448','binwalk','scan')
  ];
}());
