'use client';

import type { ComponentProps, HTMLAttributes } from 'react';
import { Streamdown } from 'streamdown';
import { cn } from '@/lib/utils';

export type MessageProps=HTMLAttributes<HTMLDivElement>&{from:'user'|'assistant'};
export function Message({from,className,...props}:MessageProps){return <div className={cn('group flex w-full items-end gap-2 py-3',from==='user'?'is-user justify-end':'is-assistant justify-start',className)} {...props}/>}
export function MessageContent({className,...props}:HTMLAttributes<HTMLDivElement>){return <div className={cn('max-w-[88%] rounded-lg px-4 py-3 text-sm group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground group-[.is-assistant]:bg-secondary group-[.is-assistant]:text-foreground',className)} {...props}/>}
export function MessageResponse({children,className,...props}:ComponentProps<typeof Streamdown>){return <Streamdown className={cn('solarops-markdown',className)} {...props}>{String(children??'')}</Streamdown>}
