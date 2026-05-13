import axios from 'axios';

async function testUpdate() {
    try {
        console.log('🚀 Sending PATCH request to update device...');
        const response = await axios.patch('http://localhost:5000/api/devices/test-device-001', {
            name: 'Updated Test Device ' + new Date().toLocaleTimeString()
        });
        console.log('✅ Success:', response.data);
    } catch (error) {
        if (error.response) {
            console.error('❌ Error response:', error.response.data);
        } else {
            console.error('❌ Error:', error.message);
        }
    }
}

testUpdate();
