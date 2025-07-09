import axios from 'axios';
import { NET_ID, COURSE_ID } from '../common/config';

type CodeBenchResponse = {
  success: boolean;
  data?: any;
  error?: any;
};

export async function fetchLogsFromCodeBench() {
  console.log("🚀 Fetching logs from CodeBench server...");

  try {
    const response = await axios.get<CodeBenchResponse>('http://localhost:8888/cb-server/logs', {
      params: {
        net_id: NET_ID,
        course_id: COURSE_ID
      }
    });

    console.log("✅ CodeBench raw response:", response.data);

    if (response.data.success && response.data.data) {
      console.log("✅ Logs fetched from CodeBench:", response.data.data);
      return response.data.data; // Ensure your API returns logs here directly
    } else {
      console.error("❌ Failed to fetch logs from CodeBench:", response.data.error);
      return [];
    }
  } catch (error: unknown) {
    console.error("❌ Error fetching logs from CodeBench:", error);
    if (error && typeof error === 'object' && 'isAxiosError' in error) {
      // error is likely an AxiosError
      console.error("Axios error details:", (error as any).response?.data || (error as any).message);
    }
    return [];
  }
}