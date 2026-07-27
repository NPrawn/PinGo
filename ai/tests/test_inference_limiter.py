import asyncio
import unittest

from app.core.inference_limiter import InferenceLimiter


class InferenceLimiterTest(unittest.TestCase):
    def test_rejects_when_running_and_queue_are_full(self):
        async def scenario():
            limiter = InferenceLimiter(max_concurrent=1, max_queue_size=0)

            self.assertTrue(await limiter.acquire())
            self.assertFalse(await limiter.acquire())
            await limiter.release()

        asyncio.run(scenario())

    def test_waiting_request_runs_after_release(self):
        async def scenario():
            limiter = InferenceLimiter(max_concurrent=1, max_queue_size=1)
            self.assertTrue(await limiter.acquire())

            waiter = asyncio.create_task(limiter.acquire())
            await asyncio.sleep(0)
            snapshot = await limiter.snapshot()
            self.assertEqual(snapshot.running, 1)
            self.assertEqual(snapshot.waiting, 1)

            await limiter.release()
            self.assertTrue(await waiter)
            snapshot = await limiter.snapshot()
            self.assertEqual(snapshot.running, 1)
            self.assertEqual(snapshot.waiting, 0)
            await limiter.release()

        asyncio.run(scenario())


if __name__ == "__main__":
    unittest.main()
