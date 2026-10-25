import Link from "next/link";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "./ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Separator } from "./ui/separator";
import { Button } from "./ui/button";
import { CloudCheck, Play, Redo2, Undo2 } from "lucide-react";

export default function Header() {
    const items = [
        { label: "Apple", value: "apple" },
        { label: "Banana", value: "banana" },
        { label: "Blueberry", value: "blueberry" },
        { label: "Grapes", value: "grapes" },
        { label: "Pineapple", value: "pineapple" },
    ]

    return (
        <header className='p-5 flex justify-between items-center border-b'>
            <div className='flex gap-5 items-center'>
                <Link href='/'>
                    <Avatar size='lg' shape='square'>
                        <AvatarImage src='https://github.com/shadcn.png' alt='shadcn'/>
                        <AvatarFallback>SC</AvatarFallback>
                    </Avatar>
                </Link>
                <div className='flex gap-3 items-center'>
                    <h4 className='text-sm text-muted-foreground'>Workspace</h4>
                    <h4 className='text-sm text-muted-foreground'>/</h4>
                    <Select variant='ghost'>
                        <SelectTrigger className='text-md p-0'>
                            <SelectValue/>
                        </SelectTrigger>
                        <SelectContent
                            alignItemWithTrigger={false}
                        >
                            {items.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Separator orientation="vertical" className='my-1'/>
                <div className='flex text-muted-foreground'>
                    <Button variant='ghost' size='icon'>
                        <Undo2/>
                    </Button>
                    <Button variant='ghost' size='icon'>
                        <Redo2/>
                    </Button>
                </div>
                <div className='flex text-muted-foreground gap-2.5 items-center'>
                    <CloudCheck size={20}/>
                    <h5 className='text-sm'>All changes saved</h5>
                </div>
            </div>
            <div className='flex gap-5 items-center'>
                <AvatarGroup>
                    <Avatar>
                        <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                        <AvatarFallback>CN</AvatarFallback>
                    </Avatar>
                    <Avatar>
                        <AvatarImage src="https://github.com/maxleiter.png" alt="@maxleiter" />
                        <AvatarFallback>LR</AvatarFallback>
                    </Avatar>
                    <Avatar>
                        <AvatarImage
                            src="https://github.com/evilrabbit.png"
                            alt="@evilrabbit"
                        />
                        <AvatarFallback>ER</AvatarFallback>
                    </Avatar>
                    <AvatarGroupCount>+3</AvatarGroupCount>
                </AvatarGroup>
                <Button variant='outline' size='lg'>
                    <Play/>
                    Preview
                </Button>
                <Button size='lg'>
                    Publish
                </Button>
            </div>
        </header>
    )
}
