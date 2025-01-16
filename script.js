//API 설정 ------------------------------------------------------------------------------------------------------------------------------

let apiKey = "";
const chatEndpoint = "https://api.openai.com/v1/chat/completions";
const embeddingsEndpoint = "https://api.openai.com/v1/embeddings";

console.log(apiKey)

let notes = [];
let groups = [];
let selectedNote = null;
let selectedGroup = null;

let isSelecting = false;
let selectionStartX, selectionStartY;
let $selectionBox;



// 로딩 스피너 ------------------------------------------------------------------------------------------------------------------------------
const toggleLoadingSpinner = (show) => {
    $('.loading-container').css('display', show ? 'flex' : 'none');
};
// callGPT([질문], [콜백 함수]) --------------------------------------------------------------------------------------------------------------
function callGPT(prompt, callback) {
    toggleLoadingSpinner(true);
    $.ajax({
        url: chatEndpoint,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        data: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{
                role: "user",
                content: prompt
            }]
        }),
        success: function(data) {
            toggleLoadingSpinner(false);
            if (callback) callback(data.choices[0].message.content);
        },
        error: function() {
            toggleLoadingSpinner(false);
            alert("Error occurred while calling GPT");
        }
    });
}



// 버튼을 클릭했을 때 노트를 추가 --------------------------------------------------------------------------------------------------------------
$('#noteAdd').on('click', function() {
    let message = $('#noteInput').val();
    let messages = message.split('\n');

    messages.forEach(msg => {
        if (msg.trim() !== '') {
            const note = { id: notes.length + 1, text: msg.trim() };
            notes.push(note);
            addNoteToDisplay(note);
        }
    });

    $('#noteInput').val('');
});
// 노트 클릭 이벤트 --------------------------------------------------------------------------------------------------------------
$('#notes, #groups').on('click', '.note', function(event) {
    event.stopPropagation(); // 이벤트 전파 중지
    selectedNote = $(this);
    const floatBtn2 = $('.floatBtn2');
    // floatBtn2 클래스 설정 'beforeGroup' or 'afterGroup' > 유사도 검사 시 그룹핑 상태 참고를 위해
    const isGroup = $(this).closest('#groups').length > 0;
    floatBtn2.removeClass('beforeGroup afterGroup');
    floatBtn2.addClass(isGroup ? 'afterGroup' : 'beforeGroup');
    floatBtn2.css({
        display: 'flex',
        top: event.pageY - floatBtn2.outerHeight() - 10 + 'px',
        left: event.pageX - (floatBtn2.outerWidth() / 2) + 'px'
    });
});
// 노트를 화면에 추가하는 함수 --------------------------------------------------------------------------------------------------------------
let noteIndex = 0;
function addNoteToDisplay(note) {
    noteIndex++;
    const $noteElement = $('<div>')
        .addClass('note')
        .attr('id', 'note-' + `${noteIndex}`)
        .text(note.text)
        .attr('contenteditable', 'true')
    $('#notes').append($noteElement);

    // 노트를 화면 전체에 랜덤하게 배치
    const windowWidth = $(window).width();
    const windowHeight = $(window).height();
    const noteWidth = $noteElement.outerWidth();
    const noteHeight = $noteElement.outerHeight();
    const headerHeight = 64; // 헤더 높이

    const randomLeft = (Math.random() * windowWidth) - noteWidth;
    const randomTop = (Math.random() * (windowHeight - noteHeight - headerHeight)) + headerHeight;

    $noteElement.css({
        left: randomLeft + 'px',
        top: randomTop + 'px'
    });

    // 드래그 가능하게 설정
    makeNoteDraggable($noteElement);
}



//유사도 측정 기능 ------------------------------------------------------------------------------------------------------------------------------
//유사도 검사 버튼 클릭 ------------------------------------------------------------------------------------------------------------------------------
$('#similarityBtn').click(function () {
    if (selectedNote) {
        const noteData = selectedNote.text();
        const targetClass = $('.floatBtn2').hasClass('beforeGroup') ? 'note' : 'groupnote';
        applySimilarityColors(noteData, targetClass);
    } else {
        alert('노트를 선택하세요!');
    }
});
// 공통된 유사도 계산 및 색상 적용 함수
function applySimilarityColors(selectedNote, targetClass) {
    const texts = notes.map(note => note.text);
    getSimilarities(selectedNote, texts).then(similarities => {
        similarities.forEach((similarity, index) => {
            const intensity = Math.floor((1 - similarity) * 255);
            const color = `rgb(255, 255, ${intensity})`;
            $(`#${targetClass}-${notes[index].id}`).css('background-color', color);
        });
    });
}
//그룹간 유사도 검사 버튼 클릭
$('#groups').on('click', '.group-title', function(event) {
    $('#similarityBtn2').css({
        display: 'flex',
        top: event.pageY - $('#similarityBtn2').outerHeight() - 10 + 'px',
        left: event.pageX - ($('#similarityBtn2').outerWidth() / 2) + 'px'
    });
    selectedGroup = $(this).text();
});
$('#similarityBtn2').click(function(){
    applySimilarityColors2(selectedGroup);
    $('#similarityBtn2').hide();
})
//그룹간 유사도 측정
function applySimilarityColors2(selectedNote) {
    const groupTitles = document.querySelectorAll('.group-title');
    const texts = Array.from(groupTitles).map(title => title.textContent);

    getSimilarities(selectedNote, texts).then(similarities => {
        similarities.forEach((similarity, index) => {
            const intensity = Math.floor((1 - similarity) * 255);
            const color = `rgb(${intensity}, ${intensity}, 255)`;            

            const groupTitleElement = document.querySelector(`#titlenote-${index + 1}`);
            groupTitleElement.style.backgroundColor = color;
            groupTitleElement.style.color = '#fff';
        });
    });
}
//유사도 측정 공통
async function getSimilarities(selectedText, texts) {
    const response = await fetch(embeddingsEndpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: texts
        })
    });
    const data = await response.json();
    const embeddings = data.data.map(item => item.embedding);

    const selectedIndex = texts.indexOf(selectedText);
    const selectedEmbedding = embeddings[selectedIndex];

    const similarities = texts.map((_, i) => {
        const embedding = embeddings[i];
        return cosineSimilarity(selectedEmbedding, embedding);
    });

    console.log(similarities)//이거 왜이리 많이 출력되는지 확인 필요 > 토큰 낭비

    return similarities;
}
function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}



// AID 기능 1 - 그룹핑 -----------------------------------------------------------------------------------------------------------------------
$('#group').on('click', function() {
    if (notes.length >= 5) {
        // 각 노트의 고유 ID와 텍스트를 가져옴
        const notesWithId = notes.map((note, index) => {
            const noteId = index + 1;
            const noteText = note.text;
            console.log(`Note ID: ${noteId}, Text: ${noteText}`);
            return { id: noteId, text: noteText };
        });
        const notesText = notesWithId.map(note => `ID: ${note.id}, 내용: ${note.text}`).join("\n");

        // 프롬프트
        const prompt = 
        `You are a UX/UI designer.
        If the core content of the notes is similar, they are considered related.
        An affinity diagram is a grouping technique used to find meaningful patterns within large amounts of data.
        Group similar notes into an affinity diagram based on the following notes: ${notesText}.
        Each note has a unique ID, and you must include both the ID and the content of every note.
        **You must ensure that all notes are included in a group. No note should be left out.**
        Respond in Korean and follow the output format below:
        - 그룹 이름:
        - ID:, 내용:`;

        callGPT(prompt, (response) => {
            console.log(response);
            $('#groups').empty();
            $('#notes').empty();
            addGroupToDisplay(response);
        });
    } else {
        alert("노트를 5개 이상 입력하세요.");
    }
});
let globalNoteId = 1;
function addGroupToDisplay(response) {
    let groupTitleId = 1;  // 그룹 타이틀 ID 초기화

    // GPT의 응답을 그룹 이름과 내용으로 분리
    try {
        // 'Group' 키워드를 기준으로 그룹을 분리
        const groups = response.split('- 그룹 이름:').slice(1);
        if (groups.length === 0) {
            console.error("No valid groups found in the GPT response.");
            return;
        }

        groups.forEach(group => {
            // 그룹 이름과 노트 내용을 분리
            const [title, ...notes] = group.split('- ID:');
            const trimmedNotes = notes.map(note => note.trim()).filter(note => note);

            // 그룹을 화면에 추가하는 로직
            const groupContainer = $('<div>').addClass('group-container');

            // 인사이트 컨테이너 추가
            const insightContainer = $('<div>').addClass('insight-container visible');
            groupContainer.append(insightContainer);
            insightContainer.append("<p>인사이트</p>");
            groupContainer.append('<img class="insight-icon" src="./images/icon/insight_inactive.png" alt="#" width="48px">');

            // 그룹 타이틀 추가 및 수정 가능하게 설정
            const groupTitle = $('<div>').addClass('group-title').text(`${title.trim()}`)
                .attr('id', `titlenote-${groupTitleId++}`)
                .attr('contenteditable', 'true'); // 그룹 타이틀 수정 가능
            groupContainer.append(groupTitle);

            if (typeof makeNoteDraggable === 'function') {
                makeNoteDraggable(groupTitle);
            }

            // 그룹 내 노트들 추가 (ID와 '내용:' 텍스트를 제거하고 내용만 표시)
            const notesSection = $('<div>').addClass('notes');
            trimmedNotes.forEach(note => {
                // 'ID:'와 '내용:' 텍스트를 제거하고 내용만 추출
                const noteText = note.replace(/^\d+, 내용: /, '').trim();
                const noteDiv = $('<div>').addClass('note').text(noteText)
                    .attr('id', `groupnote-${globalNoteId++}`)
                    .attr('contenteditable', 'true'); // 노트 수정 가능
                notesSection.append(noteDiv);

                if (typeof makeNoteDraggable === 'function') {
                    makeNoteDraggable(noteDiv);
                }
            });

            groupContainer.append(notesSection);
            $('#groups').append(groupContainer);
        });
    } catch (error) {
        console.error("An error occurred while processing the GPT response:", error);
    }
}

// AID 기능 2 - 상위 헤더 추출 -----------------------------------------------------------------------------------------------------------------------
$('#headerExtraction').on('click', function() {
    let groupNotes = '';
    $('.group-container').each(function() {
        let title = $(this).find('.group-title').text();
        groupNotes += '그룹이름: ' + title ;
    });

    const prompt =
    `너는 UX/UI 디자이너고 affinity diagram을 진행 중이야.
    아래 그룹핑된 결과를 참고하여 공통된 내용을 기준으로 상위 헤더를 생성한다.
    각 그룹의 이름과 내용을 바탕으로 관련 있는 그룹을 묶어 상위 헤더 이름을 정하고 그 아래에 그룹들을 나열한다.
    상위 헤더 이름은 그룹의 공통점을 알 수 있게 짓는다.
    그룹을 중복되게 묶지 않는다.
    그룹 내용이 아닌 그룹 이름을 정확히 입력한다.
    출력된 답변을 파싱하여 사용할 것이기 때문에 앞서 사용한 그룹 이름을 정확히 입력한다.

    출력형식에 맞춰 답변을 출력한다.
    출력 형식: 
    - 상위헤더이름:
    - 그룹이름:
    - 그룹이름:

    - 상위헤더이름:
    - 그룹이름:

    다음은 그룹핑 결과야: ${groupNotes}`;

    console.log(groupNotes)

    callGPT(prompt, function(response) {
        console.log(response);
        addHeaderToDisplay(response);
    });
});
function addHeaderToDisplay(response) {
    let $existingGroups = $('.group-container').clone();

    let lines = response.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    let $groupsContainer = $('#groups');
    $groupsContainer.empty();

    let $currentTopContainer = null;

    lines.forEach(line => {
        if (line.startsWith('- 상위헤더이름:')) {
            if ($currentTopContainer) {
                $groupsContainer.append($currentTopContainer);
            }
            let header = line.replace('- 상위헤더이름: ', '').trim();
            $currentTopContainer = $('<div class="group-container-top"></div>');
            $currentTopContainer.append(`<div class="group-title-top" contenteditable="true">${header}</div>`);
        } else if (line.startsWith('- 그룹이름:')) {
            let groupName = line.replace('- 그룹이름: ', '').trim();
            let $existingGroup = $existingGroups.filter(`:has(.group-title:contains(${groupName}))`).clone();
            if ($currentTopContainer) {
                $currentTopContainer.append($existingGroup);
                $existingGroup.find('.note').each(function() {
                    makeNoteDraggable($(this));
                });
            }
        }
    });

    if ($currentTopContainer) {
        $groupsContainer.append($currentTopContainer);
    }
}

// AID 기능 3 - 중복 노트 정리 -----------------------------------------------------------------------------------------------------------------------
$('#dataCleanup').on('click', function() {
    const notesWithId = notes.map((note, index) => {
        const noteId = index + 1;
        const noteText = note.text;
        console.log(`Note ID: ${noteId}, Text: ${noteText}`);
        return { id: noteId, text: noteText };
    });
    const notesText = notesWithId.map(note => `ID: ${note.id}, 내용: ${note.text}`).join("\n");
    
    const prompt =
    `너는 UX/UI 디자이너야.
    노트의 핵심 내용이 일치하면 유사한 노트이다.
    예를 들어, '너무 무거워서 불편하다'와 '많이 무겁다'는 유사한 노트로 간주한다.
    노트 데이터 중에서 유사한 노트를 찾아 그룹화한다.
    각 그룹은 중복된 노트의 인덱스를 포함하며, 형식은 다음과 같다.
    형식: [[1,3], [2,4,5]]
    노트 데이터: ${notesText}
    출력 형식: [[ID,ID], [ID,ID,ID]]`;

    console.log(prompt)

    callGPT(prompt, function(response) {
        console.log(response)
        try {
            // GPT 응답에서 그룹화된 배열을 파싱
            const groupedIndexes = JSON.parse(response);

            // 각 그룹의 첫 번째 노트를 제외한 나머지 노트를 회색으로 표시
            groupedIndexes.forEach(group => {
                group.slice(1).forEach(index => {
                    $(`.note:eq(${index - 1})`).css('background-color', '#DEDEDE');
                });
            });
        } catch (e) {
            console.error("Error parsing GPT response:", e);
        }
    });
});

// AID 기능 4 - 인사이트 생성 -----------------------------------------------------------------------------------------------------------------------
$('#insight').on('click', function() {
    $('#groups .group-container').each(function(index, element) {
        const groupName = $(element).find('.group-title').text();
        const notesText = $(element).find('.note').map(function() {
            return $(this).text();
        }).get().join('\n');

        const prompt =
        `너는 UX/UI 디자이너야.
        인사이트는 공통된 개선점이나 새롭게 알게 된 사실이다.
        인사이트는 구체적이고 실용적이어야 하며, 그룹의 주제와 관련성이 높아야 한다.
        그룹이름: ${groupName} 그룹내용: ${notesText}
        위 내용을 보고 인사이트를 한 문장으로 정리한다.
        출력형식에 맞게 답변을 출력한다.
        출력형식: 인사이트:`;

        callGPT(prompt, (response) => {
            console.log(response);
            const insightText = response.replace('인사이트:', '').trim();
            const $insightElement = $('<div>')
                .addClass('insight-note')
                .text(insightText)
                .attr('contenteditable', 'true');

            $(element).find('.insight-container').append($insightElement);
        });
    });
    $('.insight-icon').css('display', 'inline-block');
});
//인사이트 보이기/숨기기
$('#groups').on('click', '.insight-icon', function() {
    const $icon = $(this);
    const $container = $icon.closest('.group-container').find('.insight-container');

    $container.toggleClass('visible');

    if ($container.hasClass('visible')) {
        $icon.attr('src', './images/icon/insight_inactive.png');
    } else {
        $icon.attr('src', './images/icon/insight_active.png');
    }
});



// 플로팅 버튼 숨기기 --------------------------------------------------------------------------------------------------------------
$(document).click(function () {
    $('.floatBtn2').hide(); 
});
// 플로팅 버튼 클릭 시에도 숨겨지지 않게 하기
$('.floatBtn2').click(function (event) {
    event.stopPropagation();
});

// floatBtn2 이벤트 - 색상 폰트 설정 --------------------------------------------------------------------------------------------------------------
$('#colortoggle').on('click', function() {
    $('#fontSizeDropdown').removeClass('open');
    $('.colorContainer').toggleClass('open');
});
$('#fontSize').on('click', function() {
    $('.colorContainer').removeClass('open');
    $('#fontSizeDropdown').toggleClass('open');
});
$('#fontWeight').on('click', function() {
    selectedNote.toggleClass('bold');
});
$('.color-btn').on('click', function() {
    const selectedColor = $(this).css('background-color');
    selectedNote.css('background-color', selectedColor);
})
$('.FS').on('click', function() {
    const selectedSize = $(this).data('size');
    selectedNote.css('font-size', selectedSize);
    $('.FS').removeClass('chosen');
    $(this).addClass('chosen');
})



//엑셀 관련 기능 --------------------------------------------------------------------------------------------------------------
//엑셀추가 업로드 버튼 가리기
document.getElementById('uploadButton').addEventListener('click', function() {
    document.getElementById('fileInput').click();
});
//엑셀로 추가하기
document.getElementById('fileInput').addEventListener('change', function(event) {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (!file) {
        alert('Please select a file.');
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

        const interviewees = jsonData[0];  // 첫 번째 행을 여전히 인터뷰 대상자 배열로 사용
        const $outputDiv = $('#notes');
        $outputDiv.empty();

        // 첫 번째 행을 제외한 데이터만 처리하기 위해 slice(1)를 사용
        jsonData.slice(1).forEach((row, rowIndex) => {
            row.forEach((noteText, colIndex) => {
                if (noteText === undefined || interviewees[colIndex] === undefined) return;

                const note = {
                    id: notes.length + 1,
                    text: `${noteText}`,
                    interviewee: `${interviewees[colIndex]}`,
                    color: '',
                    position: { left: 0, top: 0 },
                    group: '',
                    upperGroup: ''
                };
                notes.push(note);
                noteIndex++;
                const $noteElement = $('<div>')
                .addClass('note')
                .attr('id', 'note-' + `${note.id}`)
                .text(note.text)
                .attr('contenteditable', 'true') // 노트 수정 가능

                $('#notes').append($noteElement);
            
                // 노트를 화면 전체에 랜덤하게 배치
                const windowWidth = $(window).width();
                const windowHeight = $(window).height();
                const noteWidth = $noteElement.outerWidth();
                const noteHeight = $noteElement.outerHeight();
                const headerHeight = 64; // 헤더 높이
            
                // 랜덤한 left와 top 값을 계산
                const randomLeft = Math.random() * (windowWidth - noteWidth);
                const randomTop = (Math.random() * (windowHeight - noteHeight - headerHeight)) + headerHeight;
            
                // 노트 위치 설정
                $noteElement.css({
                    left: randomLeft + 'px',
                    top: randomTop + 'px'
                });
            
                // 드래그 가능하게 설정
                makeNoteDraggable($noteElement);
            });
        });
    };
    reader.readAsArrayBuffer(file);
});
//엑셀로 내보내기
function exportNotes() {
    const dataForExport = [];

    // 모든 note 요소 탐색
    $('.note').each(function () {
        const $note = $(this);
        const noteText = $note.text().trim();

        const $groupContainer = $note.closest('.group-container');
        const upperGroup = $groupContainer.siblings('.group-title-top').text().trim() || '';
        const groupTitle = $groupContainer.find('.group-title').text().trim() || '';
        const insightElement = $groupContainer.find('.insight-note').text().trim() || '';

        dataForExport.push({
            '2차헤더': upperGroup,
            '1차헤더': groupTitle,
            'Insight': insightElement,
            'Note': noteText,
            '인터뷰 대상자': ''
        });
    });

    // 데이터 정렬
    dataForExport.sort((a, b) => a['2차헤더'].localeCompare(b['2차헤더']));

    const worksheet = XLSX.utils.json_to_sheet(dataForExport, { header: ['2차헤더', '1차헤더', 'Insight', 'Note', '인터뷰 대상자'] });

    // 병합 설정
    const merges = [];
    let startRow = 1;

    // 병합 기준 배열 설정
    const mergeColumns = ['2차헤더', '1차헤더', 'Insight'];
    
    // 병합 반복 실행
    mergeColumns.forEach((key, col) => {
        startRow = 1;
        for (let i = 1; i < dataForExport.length; i++) {
            if (dataForExport[i][key] !== dataForExport[i - 1][key]) {
                if (startRow < i) {
                    merges.push({ s: { r: startRow, c: col }, e: { r: i - 1, c: col } }); // 셀 병합
                }
                startRow = i;
            }
        }
        merges.push({ s: { r: startRow, c: col }, e: { r: dataForExport.length, c: col } }); // 마지막 병합
    });

    worksheet['!merges'] = merges;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Notes");

    // 엑셀 파일 다운로드
    XLSX.writeFile(workbook, '한국공학대학교_mix-lab_Affinity-service.xlsx');
}
document.getElementById('export-btn').addEventListener('click', function() {
    exportNotes();
});





// 드래그 이동 처리기
function dragMoveListener(event) {
    var target = event.target;
    var x = (parseFloat($(target).attr('data-x')) || 0) + event.dx;
    var y = (parseFloat($(target).attr('data-y')) || 0) + event.dy;

    $(target).css('transform', 'translate(' + x + 'px, ' + y + 'px)');
    $(target).attr('data-x', x);
    $(target).attr('data-y', y);
}
// 드래그 가능하게 설정하는 함수
function makeNoteDraggable($noteElement) {
    interact($noteElement[0]).draggable({
        onmove: dragMoveListener,
        onend: function (event) {
            var target = $(event.target);
            var wasDropped = false;

            $('.group-container .notes').each(function () {
                var $notesSection = $(this);
                var offset = $notesSection.offset();
                var width = $notesSection.outerWidth();
                var height = $notesSection.outerHeight();

                if (
                    event.pageX > offset.left &&
                    event.pageX < offset.left + width &&
                    event.pageY > offset.top &&
                    event.pageY < offset.top + height
                ) {
                    // 노트를 새로운 그룹으로 이동
                    $notesSection.append(target);
                    wasDropped = true;
                    return false; // break the loop
                }
            });

            if (!wasDropped) {
                // 노트가 그룹 영역 밖으로 드랍되면 원래 자리로 돌아가게 하려면 아래 코드 추가
                var x = (parseFloat(target.attr('data-x')) || 0);
                var y = (parseFloat(target.attr('data-y')) || 0);
                target.css('transform', 'translate(' + x + 'px, ' + y + 'px)');
            } else {
                // 새로운 그룹으로 노트를 이동시켰을 때, 노트 위치 초기화
                target.css('transform', 'translate(0px, 0px)');
                target.attr('data-x', 0);
                target.attr('data-y', 0);
            }
        }
    });
}
// 전역으로 사용할 수 있도록 설정
window.dragMoveListener = dragMoveListener;


// F5 및 Ctrl+R 키를 통한 새로고침 막기 + 경고창 표시
document.addEventListener('keydown', function(event) {
    if ((event.ctrlKey && event.key === 'r') || event.key === 'F5') {
        event.preventDefault();
        const confirmation = confirm("현재 페이지에서 나가시겠습니까?");
        if (confirmation) {
            location.reload();
        }
    }
});
// 뒤로 가기 또는 새로고침 시 경고창 표시
window.onbeforeunload = function(event) {
    event.preventDefault();
    event.returnValue = "현재 페이지에서 나가시겠습니까?"; 
    return "현재 페이지에서 나가시겠습니까?";
};



//apikey교체 ------------------------------------------------------------------------------------------------------------
document.getElementById('changeApikey').onclick = function() {
    document.getElementById('apikeyModal').style.display = 'block';
};
// 모달 닫기
document.querySelector('.close').onclick = function() {
    document.getElementById('apikeyModal').style.display = 'none';
};
// 사용자가 모달 바깥을 클릭했을 때 모달 닫기
window.onclick = function(event) {
    if (event.target == document.getElementById('apikeyModal')) {
        document.getElementById('apikeyModal').style.display = 'none';
    }
};
// API Key 업데이트 함수
function updateApiKey() {
    const newApiKey = document. querySelector('.apikey-input').value;
    const inputField = document.querySelector('.input-button-modal');
    if (newApiKey) {
        apiKey = newApiKey;
        alert("API Key가 설정되었습니다!");
        document.getElementById('input-apikey').style.display = 'none';
        document.getElementById('apikeyModal').style.display = 'none';
        inputField.value = "";
    } else {
        alert("유효한 API Key를 입력하세요.");
    }
    console.log("Current API Key:", apiKey);
}
// 페이지가 로드될 때 apiKey 입력창을 무조건 표시
window.onload = function() {
    document.getElementById('input-apikey').style.display = 'flex';

    document.getElementById('introModal').style.display = 'flex';
};



//시작모달 ------------------------------------------------------------------------------------------------------------
$(document).ready(function() {
    let currentSlide = 0;
    const totalSlides = 5;


    const introSteps = [
        "Step1",
        "Step2",
        "Step3",
        "Step4",
        "Step5",
    ];

    const introTitles = [
        "API Key를 입력하여 모든 기능을<br/>사용해보세요.",
        "어피니티 다이어그램을 진행할<br/>노트를 입력해보세요.",
        "사이드바로 그룹핑, 인사이트, 노트정리, 헤더 추출을 이용해보세요.",
        "직접 수정해서 더 나은 결과를<br/>도출해보세요",
        "완성된 어피니티 다이어그램을<br/>내 컴퓨터에 저장해보세요."
    ];

    const introTexts = [
        "자신의 Open API KEY를 발급해서 입력하면<br/>모든 기능을 사용할 수 있습니다.<br/><br/>본 서비스를 이용하기에 앞서 아래 링크를 통해<br/>API KEY를 발급해주세요.<br/><br/>https://platform.openai.com/api-keys",
        "노트에 들어갈 내용들은 문장으로 작성해주세요.<br/><br/>엔터키로 문장들을 구분해주면 편리하게 여러 노트를<br/>업로드 할 수 있습니다.<br/><br/>또한, 리서치 내용을 정리한 엑셀 파일을 업로드하여<br/>노트들을 생성할 수 있습니다.",
        "사이드바에서 그룹짓기, 중복정리, 인사이트, 2차헤더를<br/>통해 AI를 활용한 어피니티 다이어그램이 가능해요.<br/><br/>내용간의 관련성을 알고 싶다면 해당 노트를<br/>더블클릭 해보세요.<br/><br/>유사도가 높을수록 주변 노트들의 노란색 채도가<br/>높아집니다.",
        "노트의 컬러와 폰트 또는 내용을 수정하거나<br/>직접 노트를 이동하여 인공지능의 그룹핑 결과를<br/>원하는 대로 수정할 수 있어요",
        "Export 버튼을 눌러 완성된 어피니티 다이어그램을<br/>엑셀 형식으로 추출할 수 있어요.<br/><br/>그룹핑과 인사이트 생성이 완료된 후 추출이 가능해요."
    ];

    // Cancel 버튼 클릭 시 인트로 모달 숨김
    $('#cancel').on('click', function() {
        $('#introModal').hide();
    });

    $('#next-btn').on('click', function() {
        if (currentSlide < totalSlides - 1) {
            currentSlide++;
            updateCarousel();
        } else {
            $('#introModal').hide();
            $('#input-apikey').show();
        }
    });

    $('#prev-btn').on('click', function() {
        if (currentSlide > 0) {
            currentSlide--;
            updateCarousel();
        }
    });

    function updateCarousel() {
        // 현재 슬라이드의 제목과 내용을 업데이트
        $('#step').html(introSteps[currentSlide]);
        $('#h1').html(introTitles[currentSlide]);
        $('#p').html(introTexts[currentSlide]);

        // 이미지 업데이트
        $('#popupImg').attr('src', `./images/popup${currentSlide + 1}.png`);

        // 이전 버튼 활성화 및 비활성화 설정
        if (currentSlide === 0) {
            $('#prev-btn').attr('disabled', true);
        } else {
            $('#prev-btn').attr('disabled', false);
        }

        // 마지막 슬라이드에서 버튼 텍스트를 '시작하기'로 변경하고 색상 변경
    if (currentSlide === totalSlides - 1) {
        $('#next-btn').text('시작하기');
        $('#next-btn').css('background-color', 'var(--pr)'); // 파란색으로 변경
    } else {
        $('#next-btn').text('다음');
        $('#next-btn').css('background-color', 'var(--g6)'); // 기본 색상으로 복원
    }

        // 슬라이드 인디케이터 업데이트
        $('.indicator').removeClass('active');
        $('.indicator').eq(currentSlide).addClass('active');
    }

    // 페이지 로드 시 초기 슬라이드 업데이트
    updateCarousel();
});