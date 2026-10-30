"use client";

import {
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { useDesignSystemPage } from "./useDesignSystemPage";

const COLORS: string[] = ["blue", "gray", "green", "yellow", "red", "cyan", "pink"];

const ROWS: { name: string; apartment: string; status: string; color: string }[] = [
  { name: "홍길동", apartment: "래미안 1단지", status: "승인", color: "green" },
  { name: "김철수", apartment: "자이 2단지", status: "대기", color: "yellow" },
  { name: "이영희", apartment: "힐스테이트", status: "거절", color: "red" },
];

export default function DesignSystemPage(): React.ReactElement {
  const page = useDesignSystemPage();

  return (
    <Stack p="xl" gap="xl" maw={1200}>
      <div>
        <Title order={2}>디자인 시스템</Title>
        <Text c="dimmed">Mantine 테마 미리보기 — 색·반경·밀도 확정용</Text>
      </div>

      <Card>
        <Title order={4} mb="md">색상</Title>
        <SimpleGrid cols={{ base: 2, sm: 4, md: 7 }}>
          {COLORS.map((color) => (
            <Stack key={color} gap={4}>
              {[1, 3, 6, 8].map((shade) => (
                <div
                  key={shade}
                  style={{ height: 28, borderRadius: 6, background: `var(--mantine-color-${color}-${shade})` }}
                />
              ))}
              <Text size="xs" c="dimmed">{color}</Text>
            </Stack>
          ))}
        </SimpleGrid>
      </Card>

      <Card>
        <Title order={4} mb="md">버튼 · 배지</Title>
        <Stack>
          <Group>
            <Button>기본</Button>
            <Button variant="light">Light</Button>
            <Button variant="light">Outline</Button>
            <Button variant="default">Default</Button>
            <Button variant="subtle">Subtle</Button>
            <Button color="red">삭제</Button>
            <Button onClick={page.openModal}>모달 열기</Button>
          </Group>
          <Group>
            <Badge>기본</Badge>
            <Badge color="green">승인</Badge>
            <Badge color="yellow">대기</Badge>
            <Badge color="red">거절</Badge>
            <Badge color="gray">비활성</Badge>
            <Badge variant="filled">Filled</Badge>
          </Group>
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card>
          <Title order={4} mb="md">입력</Title>
          <Stack>
            <TextInput label="이름" placeholder="이름을 입력하세요" />
            <Select label="아파트" placeholder="선택" data={["래미안 1단지", "자이 2단지", "힐스테이트"]} />
            <Textarea label="메모" placeholder="내용" />
            <Group>
              <Checkbox label="동의" defaultChecked />
              <Switch label="자동 승인" defaultChecked />
            </Group>
          </Stack>
        </Card>

        <Card>
          <Title order={4} mb="md">탭</Title>
          <Tabs defaultValue="all">
            <Tabs.List>
              <Tabs.Tab value="all">전체</Tabs.Tab>
              <Tabs.Tab value="pending">대기</Tabs.Tab>
              <Tabs.Tab value="done">완료</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="all" pt="md"><Text>전체 목록</Text></Tabs.Panel>
            <Tabs.Panel value="pending" pt="md"><Text>대기 목록</Text></Tabs.Panel>
            <Tabs.Panel value="done" pt="md"><Text>완료 목록</Text></Tabs.Panel>
          </Tabs>
        </Card>
      </SimpleGrid>

      <Card p={0}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>이름</Table.Th>
              <Table.Th>아파트</Table.Th>
              <Table.Th>상태</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {ROWS.map((row) => (
              <Table.Tr key={row.name}>
                <Table.Td>{row.name}</Table.Td>
                <Table.Td>{row.apartment}</Table.Td>
                <Table.Td><Badge color={row.color}>{row.status}</Badge></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal opened={page.modalOpened} onClose={page.closeModal} title="모달 예시">
        <Stack>
          <Text>모달 내용입니다.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={page.closeModal}>취소</Button>
            <Button onClick={page.closeModal}>확인</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
