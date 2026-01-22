document.addEventListener('DOMContentLoaded', () => {
    // عناصر الواجهة
    const canvas = document.getElementById('preview-canvas');
    const ctx = canvas.getContext('2d');
    const imgUpload = document.getElementById('image-upload');
    const audioUpload = document.getElementById('audio-upload');
    const platformBtns = document.querySelectorAll('.platform-btn');
    const renderBtn = document.getElementById('render-btn');
    const audioPlayer = document.getElementById('audio-player');
    const loader = document.getElementById('loader');
    const downloadZone = document.getElementById('download-zone');
    const downloadLink = document.getElementById('download-link');
    const progressText = document.getElementById('progress-text');
    const resetBtn = document.getElementById('reset-btn');

    // المتغيرات
    let currentImage = new Image();
    let isImageLoaded = false;
    let isAudioLoaded = false;
    let canvasWidth = 1920;
    let canvasHeight = 1080;
    let mediaRecorder;
    let recordedChunks = [];
    
    // 1. إعدادات المنصة (يوتيوب، تيك توك...)
    platformBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // تحديث الأزرار
            platformBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // تحديث الأبعاد
            canvasWidth = parseInt(btn.dataset.w);
            canvasHeight = parseInt(btn.dataset.h);
            
            // إعادة رسم الكانفاس
            resizeCanvas();
            drawImage();
        });
    });

    function resizeCanvas() {
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
    }
    // تهيئة أولية
    resizeCanvas();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#333";
    ctx.font = "50px Tajawal";
    ctx.textAlign = "center";
    ctx.fillText("مساهم - اختر صورة", canvas.width/2, canvas.height/2);

    // 2. رفع الصورة
    imgUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            currentImage.src = url;
            currentImage.onload = () => {
                isImageLoaded = true;
                drawImage();
                document.getElementById('img-status').textContent = `تم اختيار: ${file.name}`;
                document.getElementById('img-status').style.color = "#27ae60";
            };
        }
    });

    function drawImage() {
        if (!isImageLoaded) return;
        
        // مسح الكانفاس
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // حساب الأبعاد للحفاظ على النسبة (Fit/Cover Logic)
        const scale = Math.max(canvas.width / currentImage.width, canvas.height / currentImage.height);
        const x = (canvas.width / 2) - (currentImage.width / 2) * scale;
        const y = (canvas.height / 2) - (currentImage.height / 2) * scale;
        
        ctx.drawImage(currentImage, x, y, currentImage.width * scale, currentImage.height * scale);
        
        // إضافة طبقة خفيفة للاندماج (اختياري)
        ctx.fillStyle = "rgba(0,0,0,0.1)";
        ctx.fillRect(0,0,canvas.width, canvas.height);
    }

    // 3. رفع الصوت
    audioUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            audioPlayer.src = url;
            isAudioLoaded = true;
            document.getElementById('audio-status').textContent = `تم اختيار: ${file.name}`;
            document.getElementById('audio-status').style.color = "#27ae60";
        }
    });

    // 4. عملية إنشاء الفيديو (Rendering)
    renderBtn.addEventListener('click', () => {
        if (!isImageLoaded || !isAudioLoaded) {
            alert("يرجى اختيار صورة وملف صوتي أولاً!");
            return;
        }

        startRendering();
    });

    function startRendering() {
        // إخفاء الأزرار وإظهار التحميل
        loader.classList.remove('hidden');
        renderBtn.disabled = true;
        recordedChunks = [];

        // إعداد دفق الفيديو من الكانفاس
        const videoStream = canvas.captureStream(30); // 30 FPS
        
        // دمج الصوت مع الفيديو (خدعة متقدمة)
        // نحتاج لإنشاء AudioContext لدمج الصوت في التسجيل
        const audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        const source = audioCtx.createMediaElementSource(audioPlayer);
        source.connect(dest);
        source.connect(audioCtx.destination); // لكي نسمع الصوت أثناء المعالجة (يمكن حذفه للصمت)

        // دمج المسارات
        const combinedStream = new MediaStream([
            ...videoStream.getVideoTracks(),
            ...dest.stream.getAudioTracks()
        ]);

        // إعدادات الجودة
        const bitrate = parseInt(document.getElementById('quality-select').value);
        const options = {
            mimeType: 'video/webm;codecs=vp9', // صيغة ويب عالية الجودة
            videoBitsPerSecond: bitrate
        };

        try {
            mediaRecorder = new MediaRecorder(combinedStream, options);
        } catch (e) {
            // في حال عدم دعم المتصفح لـ VP9 نعود للأساسي
            mediaRecorder = new MediaRecorder(combinedStream);
        }

        // تسجيل البيانات
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };

        // عند الانتهاء
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            
            // تجهيز زر التحميل
            downloadLink.href = url;
            // تعيين اسم الملف بناءً على التاريخ
            downloadLink.download = `Musahem_${new Date().getTime()}.webm`;
            
            loader.classList.add('hidden');
            downloadZone.classList.remove('hidden');
            renderBtn.disabled = false;
        };

        // بدء التشغيل والتسجيل
        audioPlayer.play();
        mediaRecorder.start();

        // تحديث نسبة التقدم
        const checkProgress = setInterval(() => {
            if (audioPlayer.paused || audioPlayer.ended) {
                clearInterval(checkProgress);
            } else {
                const percent = Math.round((audioPlayer.currentTime / audioPlayer.duration) * 100);
                progressText.textContent = `${percent}%`;
            }
        }, 1000);

        // إيقاف التسجيل عند انتهاء الصوت
        audioPlayer.onended = () => {
            mediaRecorder.stop();
            // إعادة رسم الصورة للتأكد من الثبات
            drawImage(); 
        };
    }

    // زر إعادة تعيين
    resetBtn.addEventListener('click', () => {
        downloadZone.classList.add('hidden');
        progressText.textContent = "0%";
    });
});
