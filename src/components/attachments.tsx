"use client";

import Image from "next/image";
import { useState } from "react";
import { IconAttach, IconVideo } from "@/components/icons";
import { ImageViewer } from "@/components/image-viewer";
import type { PostFile } from "@/lib/flow/rest";

/** 파일 크기. 1MB 밑은 KB로 — 소수점 아래를 읽을 사람이 없다. */
const fmtSize = (bytes: number) =>
  bytes >= 1 << 20
    ? `${(bytes / (1 << 20)).toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1024))}KB`;

/**
 * 동영상 확장자. `ts`(MPEG 전송 스트림)는 뺐다 — 이 팀 첨부에서는 TypeScript 파일일
 * 확률이 훨씬 높아서, 맞히는 것보다 틀리게 재생 아이콘을 다는 손해가 크다.
 */
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|avi|wmv|mkv|flv|mpe?g|ogv|m2ts|3gp)$/i;

/**
 * 첨부 한 줄 (이름 + 크기).
 *
 * **동영상은 아이콘만 바꾸고 여기서 재생하지는 않는다.** flow 첨부의 `ATCH_URL`
 * (`FLOW_DOWNLOAD_R001.act`)은 flow 로그인 세션을 요구하는데 그 `JSESSIONID`에는
 * `SameSite` 속성이 없다 — 즉 `Lax`라, 다른 출처의 하위 리소스 요청에는 쿠키가 안 붙는다.
 * `<video src>`로 걸면 파일 대신 빈 HTML 1091바이트가 온다. 우회로도 다 막혀 있다:
 * 서버가 대신 받아 오는 프록시도 같은 응답이고(API 키는 `api.flow.team`용이라 여기선
 * 무효), `fetch`로 받아 blob으로 담는 길은 `access-control-allow-origin`이 없어서 끊긴다.
 * 쿠키가 붙는 건 **최상위 이동**뿐이라 새 창으로 보낸다.
 *
 * ponytail: flow가 첨부에 서명 URL이나 인증 없는 경로를 열어 주면 그때 이미지 뷰어와
 * 같은 `<dialog>` 모달을 붙이면 된다. 그전에는 어떤 코드를 써도 빈 플레이어가 뜬다.
 */
function FileRow({ file }: { file: PostFile }) {
  const video = VIDEO_EXT.test(file.name);
  const Icon = video ? IconVideo : IconAttach;

  return (
    <a
      href={file.url}
      target="_blank"
      rel="noreferrer noopener"
      className="flex items-center gap-2 text-xs transition-colors hover:text-primary/80"
    >
      <Icon size={13} aria-hidden className="shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate text-primary underline underline-offset-2">{file.name}</span>
      {file.size > 0 && (
        <span className="tabular shrink-0 text-muted-foreground">{fmtSize(file.size)}</span>
      )}
      {/* 재생 아이콘을 달면 그 자리에서 재생될 것처럼 읽힌다. 어디서 열리는지 먼저 말해 준다 */}
      {video && <span className="shrink-0 text-muted-foreground">flow에서 재생</span>}
      <span className="sr-only"> (새 창)</span>
    </a>
  );
}

/**
 * 첨부 묶음 — 이미지는 썸네일 격자로, 나머지는 이름 한 줄로.
 *
 * **첨부가 붙는 자리마다 같은 모양이라야 한다.** 본문 첨부·댓글 첨부·펼친 상위·하위 업무의
 * 첨부가 각자 그리면 같은 파일이 자리마다 다르게 생기고, 실제로 그래서 이미지가 어떤
 * 자리에서는 링크 한 줄로만 나왔다 (BUG-050). 뷰어를 여는 상태도 여기 안에 있어서 쓰는
 * 쪽은 목록만 넘기면 된다.
 */
export function Attachments({ files }: { files: PostFile[] }) {
  /** 뷰어로 크게 보는 이미지의 자리. 비어 있으면 뷰어가 닫힌 것이다. */
  const [viewing, setViewing] = useState<number | null>(null);
  /** 썸네일이 있는 첨부 = 이미지다. 격자에 그리는 순서가 뷰어에서 넘기는 순서다. */
  const images = files.filter((f) => f.thumb);
  const rest = files.filter((f) => !f.thumb);

  return (
    <>
      {images.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {images.map((f, n) => (
            <li key={f.url}>
              {/* 전에는 flow 원본으로 나가는 새 창 링크였다. 원본이 썸네일과 같은 호스트라
                  (`flow.team/flowImg/**`) 여기서 크게 보여 줄 수 있었다 — flow 링크는
                  뷰어 안으로 내렸다 */}
              <button
                type="button"
                onClick={() => setViewing(n)}
                title={f.name}
                className="block cursor-pointer rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {/* 목록에는 flow가 만든 썸네일을 쓴다. `flow.team/flowImg/**`는 이미
                    허용 호스트다 (`next.config.ts`) */}
                <Image
                  src={f.thumb as string}
                  alt=""
                  width={72}
                  height={72}
                  className="size-18 rounded-md border border-border object-cover"
                />
                <span className="sr-only">{f.name} 크게 보기</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {rest.map((f) => (
        <FileRow key={f.url} file={f} />
      ))}

      {/* 뷰어는 열 때만 붙인다 — 안 붙으면 `<dialog>`도 없어서 키를 가로챌 일이 없다 */}
      {viewing !== null && (
        <ImageViewer files={images} at={viewing} onClose={() => setViewing(null)} />
      )}
    </>
  );
}
